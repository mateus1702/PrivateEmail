/**
 * Account Abstraction integration.
 * Submits UserOps via bundler, gets paymaster sponsor via paymaster API.
 * Mirrors project4 tools/aa-test flow (permissionless + viem).
 */

import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSimpleSmartAccount } from "permissionless/accounts";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  parseAbi,
  parseUnits,
  type Address,
} from "viem";
import {
  entryPoint07Address,
  getUserOperationReceipt,
  sendUserOperation,
} from "viem/account-abstraction";
import { getAction } from "viem/utils";
import { privateKeyToAccount } from "viem/accounts";

export interface AaConfig {
  bundlerUrl: string;
  paymasterApiUrl: string;
  rpcUrl: string;
  entryPointAddress: string;
  chainId: number;
  usdcAddress: string;
}

export interface RegisterOp {
  mailAddress: Address;
  pubKeyHex: `0x${string}`;
  ownerPrivateKeyHex: `0x${string}`;
}

export interface SendMessageOp {
  mailAddress: Address;
  recipient: Address;
  ciphertextHex: `0x${string}`;
  contentHash: `0x${string}`;
  ownerPrivateKeyHex: `0x${string}`;
}

const USDC_APPROVE_AMOUNT = parseUnits("1000000", 6);

/** Bundler HTTP timeout (ms). Increase if eth_getUserOperationReceipt often times out on slow chains. */
const BUNDLER_TIMEOUT_MS = 60_000;

/** Extended wait for receipt (ms). VM bundlers can be slow to include UserOps on Polygon. */
const RECEIPT_WAIT_TIMEOUT_MS = 180_000;
const RECEIPT_POLL_INTERVAL_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function isRetryableReceiptError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("user operation receipt") ||
    message.includes("could not be found") ||
    message.includes("not found") ||
    message.includes("unknown user operation") ||
    message.includes("failed to get user operation receipt") ||
    message.includes("rpc request failed") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable")
  );
}

async function waitForReceiptResilient(
  client: Parameters<typeof sendUserOperation>[0],
  userOpHash: `0x${string}`
) {
  const deadline = Date.now() + RECEIPT_WAIT_TIMEOUT_MS;
  let lastRetryableError: unknown;

  while (Date.now() < deadline) {
    try {
      return await getAction(client, getUserOperationReceipt, "getUserOperationReceipt")({
        hash: userOpHash,
      });
    } catch (error) {
      if (!isRetryableReceiptError(error)) throw error;
      lastRetryableError = error;
      await sleep(RECEIPT_POLL_INTERVAL_MS);
    }
  }

  const suffix = lastRetryableError
    ? ` Last bundler error: ${getErrorMessage(lastRetryableError)}`
    : "";
  throw new Error(`Timed out waiting for user operation receipt for ${userOpHash}.${suffix}`);
}

async function sendAndWait(
  client: Parameters<typeof sendUserOperation>[0],
  args: { calls: { to: Address; value: bigint; data: `0x${string}` }[] }
): Promise<`0x${string}`> {
  const userOpHash = await getAction(client, sendUserOperation, "sendUserOperation")(args);
  const receipt = await waitForReceiptResilient(client, userOpHash);
  return receipt?.receipt.transactionHash ?? userOpHash;
}

function ensureHex(val: string): `0x${string}` {
  const s = val.startsWith("0x") ? val : `0x${val}`;
  if (!/^0x[0-9a-fA-F]*$/.test(s)) throw new Error("Invalid hex string");
  return s as `0x${string}`;
}

/**
 * Returns the counterfactual SimpleAccount address for the given owner key.
 */
export async function getSmartAccountAddress(
  rpcUrl: string,
  chainId: number,
  ownerPrivateKeyHex: `0x${string}`
): Promise<Address> {
  const chain = defineChain({
    id: chainId,
    name: "Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const owner = privateKeyToAccount(ensureHex(ownerPrivateKeyHex));

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  return account.address as Address;
}

async function resolvePaymasterAddress(paymasterApiUrl: string): Promise<Address> {
  const base = paymasterApiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/paymaster-address`);
  if (!res.ok) throw new Error(`Paymaster API unreachable: ${res.status}`);
  const json = (await res.json()) as { paymasterAddress?: string };
  const addr = json.paymasterAddress?.trim();
  if (!addr) throw new Error("Paymaster API did not return paymaster address");
  return addr as Address;
}

/**
 * Submits registerPublicKey via AA. Paymasters that only support single execute()
 * require separate UserOps. First: approve paymaster to spend USDC. Second: registerPublicKey.
 */
export async function submitRegisterPublicKey(
  config: AaConfig,
  op: RegisterOp
): Promise<`0x${string}`> {
  const chain = defineChain({
    id: config.chainId,
    name: "Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const paymasterClient = createPimlicoClient({
    entryPoint: {
      address: (config.entryPointAddress as Address) || entryPoint07Address,
      version: "0.7",
    },
    transport: http(config.paymasterApiUrl),
  });

  const paymasterAddress = await resolvePaymasterAddress(config.paymasterApiUrl);

  const owner = privateKeyToAccount(ensureHex(op.ownerPrivateKeyHex));

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: (config.entryPointAddress as Address) || entryPoint07Address,
      version: "0.7",
    },
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(config.bundlerUrl, { timeout: BUNDLER_TIMEOUT_MS }),
    paymaster: paymasterClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const fees = await paymasterClient.getUserOperationGasPrice();
        return fees.fast;
      },
    },
  });

  const approveData = encodeFunctionData({
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [paymasterAddress, USDC_APPROVE_AMOUNT],
  });

  const registerData = encodeFunctionData({
    abi: parseAbi(["function registerPublicKey(bytes pubKey)"]),
    functionName: "registerPublicKey",
    args: [op.pubKeyHex],
  });

  await sendAndWait(smartAccountClient, {
    calls: [{ to: config.usdcAddress as Address, value: 0n, data: approveData }],
  });

  const hash = await sendAndWait(smartAccountClient, {
    calls: [{ to: op.mailAddress, value: 0n, data: registerData }],
  });

  return hash;
}

/**
 * Submits sendMessage via AA.
 */
export async function submitSendMessage(
  config: AaConfig,
  op: SendMessageOp
): Promise<`0x${string}`> {
  const chain = defineChain({
    id: config.chainId,
    name: "Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const paymasterClient = createPimlicoClient({
    entryPoint: {
      address: (config.entryPointAddress as Address) || entryPoint07Address,
      version: "0.7",
    },
    transport: http(config.paymasterApiUrl),
  });

  const owner = privateKeyToAccount(ensureHex(op.ownerPrivateKeyHex));

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: (config.entryPointAddress as Address) || entryPoint07Address,
      version: "0.7",
    },
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(config.bundlerUrl, { timeout: BUNDLER_TIMEOUT_MS }),
    paymaster: paymasterClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const fees = await paymasterClient.getUserOperationGasPrice();
        return fees.fast;
      },
    },
  });

  const sendData = encodeFunctionData({
    abi: parseAbi([
      "function sendMessage(address recipient, bytes ciphertext, bytes32 contentHash) returns (uint256)",
    ]),
    functionName: "sendMessage",
    args: [op.recipient, op.ciphertextHex, op.contentHash],
  });

  const hash = await sendAndWait(smartAccountClient, {
    calls: [{ to: op.mailAddress, value: 0n, data: sendData }],
  });

  return hash;
}

/** Legacy placeholder - use submitRegisterPublicKey / submitSendMessage instead. */
export async function submitUserOp(): Promise<`0x${string}`> {
  throw new Error("Use submitRegisterPublicKey or submitSendMessage instead");
}

/** Legacy placeholder - not required when using createPimlicoClient. */
export async function getPaymasterQuote(): Promise<{
  paymasterAndData: string;
  validUntil: number;
  validAfter: number;
}> {
  throw new Error("getPaymasterQuote not used with Pimlico paymaster client");
}
