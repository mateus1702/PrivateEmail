/**
 * Account Abstraction integration.
 * Submits UserOps via bundler, gets paymaster sponsor via paymaster API.
 * Mirrors project4 tools/aa-test flow (permissionless + viem).
 */

import { createSponsorClient, applySponsorshipToUserOp, isQuoteExpired as sdkIsQuoteExpired } from "./sponsor-sdk";
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
  /** Optional. When set, pm_sponsorUserOperation includes referral context. */
  referralContext?: { referralAddress: string; referralBps: number };
}

/** Quote fields from pm_sponsorUserOperation response (for cost confirmation modal). */
export interface SponsorQuote {
  estimatedBaseCostUsdcE6: string;
  estimatedReferralUsdcE6: string;
  estimatedTotalCostUsdcE6: string;
  maxBaseCostUsdcE6: string;
  maxReferralUsdcE6: string;
  maxTotalCostUsdcE6: string;
  estimatedGas: string;
  /** Unix epoch seconds - quote valid until this time (for TTL check). */
  validUntil: string;
}

/** Result of prepare + sponsor: use quote for modal, then submit preparedUserOp. */
export interface PreparedWithQuote<T = unknown> {
  preparedUserOp: T;
  quote: SponsorQuote;
}

/** Returns true if quote validUntil has passed (within buffer). Re-exports SDK helper. */
export function isQuoteExpired(quote: SponsorQuote): boolean {
  return sdkIsQuoteExpired(quote);
}

export interface RegisterOp {
  mailAddress: Address;
  pubKeyHex: `0x${string}`;
  ownerPrivateKeyHex: `0x${string}`;
}

export interface RegisterActivationOp extends RegisterOp {
  username: string;
}

export interface RegisterUsernameOp {
  mailAddress: Address;
  username: string;
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

function stringifyRpcPayload(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? `0x${v.toString(16)}` : v
  );
}

function sanitizeUserOpForBundler(preparedUserOp: Record<string, unknown>): Record<string, unknown> {
  const allowedKeys = new Set([
    "sender",
    "nonce",
    "factory",
    "factoryData",
    "callData",
    "callGasLimit",
    "verificationGasLimit",
    "preVerificationGas",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "signature",
    "paymaster",
    "paymasterData",
    "paymasterVerificationGasLimit",
    "paymasterPostOpGasLimit",
  ]);
  return Object.fromEntries(
    Object.entries(preparedUserOp).filter(([key, value]) => allowedKeys.has(key) && value != null)
  );
}

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
 * Prepare UserOp with our custom sponsor (pm_sponsorUserOperation) and return quote.
 * Caller shows modal, then submits via submitPreparedUserOp.
 */
export async function getQuoteAndPreparedOpForRegister(
  config: AaConfig,
  op: RegisterActivationOp
): Promise<PreparedWithQuote> {
  const entryPoint = (config.entryPointAddress as Address) || entryPoint07Address;
  const chain = defineChain({
    id: config.chainId,
    name: "Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const owner = privateKeyToAccount(ensureHex(op.ownerPrivateKeyHex));
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: { address: entryPoint, version: "0.7" },
  });

  const paymasterClient = createPimlicoClient({
    entryPoint: { address: entryPoint, version: "0.7" },
    transport: http(config.paymasterApiUrl),
  });
  const paymasterAddress = await resolvePaymasterAddress(config.paymasterApiUrl);

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

  const registerData = encodeFunctionData({
    abi: parseAbi(["function registerPublicKey(bytes pubKey)"]),
    functionName: "registerPublicKey",
    args: [op.pubKeyHex],
  });
  const approveData = encodeFunctionData({
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [paymasterAddress, USDC_APPROVE_AMOUNT],
  });
  const registerUsernameData = encodeFunctionData({
    abi: parseAbi(["function registerUsername(string username)"]),
    functionName: "registerUsername",
    args: [op.username],
  });

  const userOp = await (smartAccountClient as { prepareUserOperation: (args: { calls: { to: Address; value: bigint; data: `0x${string}` }[] }) => Promise<Record<string, unknown>> }).prepareUserOperation({
    calls: [
      { to: config.usdcAddress as Address, value: 0n, data: approveData },
      { to: op.mailAddress, value: 0n, data: registerData },
      { to: op.mailAddress, value: 0n, data: registerUsernameData },
    ],
  });

  const sponsorClient = createSponsorClient({
    paymasterUrl: config.paymasterApiUrl,
    entryPointAddress: entryPoint,
    referralContext: config.referralContext,
  });
  const sponsorResult = await sponsorClient.sponsor({
    userOp: userOp as Record<string, unknown>,
    referralContext: config.referralContext,
  });

  const preparedUserOp = applySponsorshipToUserOp(userOp as Record<string, unknown>, sponsorResult);

  const quote: SponsorQuote = {
    estimatedBaseCostUsdcE6: sponsorResult.estimatedBaseCostUsdcE6,
    estimatedReferralUsdcE6: sponsorResult.estimatedReferralUsdcE6,
    estimatedTotalCostUsdcE6: sponsorResult.estimatedTotalCostUsdcE6,
    maxBaseCostUsdcE6: sponsorResult.maxBaseCostUsdcE6,
    maxReferralUsdcE6: sponsorResult.maxReferralUsdcE6,
    maxTotalCostUsdcE6: sponsorResult.maxTotalCostUsdcE6,
    estimatedGas: sponsorResult.estimatedGas,
    validUntil: sponsorResult.validUntil,
  };

  return { preparedUserOp, quote };
}

/**
 * Prepare UserOp for sendMessage with sponsor quote.
 */
export async function getQuoteAndPreparedOpForSendMessage(
  config: AaConfig,
  op: SendMessageOp
): Promise<PreparedWithQuote> {
  const entryPoint = (config.entryPointAddress as Address) || entryPoint07Address;
  const chain = defineChain({
    id: config.chainId,
    name: "Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const owner = privateKeyToAccount(ensureHex(op.ownerPrivateKeyHex));
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: { address: entryPoint, version: "0.7" },
  });

  const paymasterClient = createPimlicoClient({
    entryPoint: { address: entryPoint, version: "0.7" },
    transport: http(config.paymasterApiUrl),
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

  const userOp = await (smartAccountClient as { prepareUserOperation: (args: { calls: { to: Address; value: bigint; data: `0x${string}` }[] }) => Promise<Record<string, unknown>> }).prepareUserOperation({
    calls: [{ to: op.mailAddress, value: 0n, data: sendData }],
  });

  const sponsorClient = createSponsorClient({
    paymasterUrl: config.paymasterApiUrl,
    entryPointAddress: entryPoint,
    referralContext: config.referralContext,
  });
  const sponsorResult = await sponsorClient.sponsor({
    userOp: userOp as Record<string, unknown>,
    referralContext: config.referralContext,
  });

  const preparedUserOp = applySponsorshipToUserOp(userOp as Record<string, unknown>, sponsorResult);

  const quote: SponsorQuote = {
    estimatedBaseCostUsdcE6: sponsorResult.estimatedBaseCostUsdcE6,
    estimatedReferralUsdcE6: sponsorResult.estimatedReferralUsdcE6,
    estimatedTotalCostUsdcE6: sponsorResult.estimatedTotalCostUsdcE6,
    maxBaseCostUsdcE6: sponsorResult.maxBaseCostUsdcE6,
    maxReferralUsdcE6: sponsorResult.maxReferralUsdcE6,
    maxTotalCostUsdcE6: sponsorResult.maxTotalCostUsdcE6,
    estimatedGas: sponsorResult.estimatedGas,
    validUntil: sponsorResult.validUntil,
  };

  return { preparedUserOp, quote };
}

/**
 * Send a prepared UserOp (from getQuoteAndPreparedOpFor*) to the bundler.
 */
export async function submitPreparedUserOp(
  config: AaConfig,
  preparedUserOp: Record<string, unknown>,
  ownerPrivateKeyHex: `0x${string}`
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
  const owner = privateKeyToAccount(ensureHex(ownerPrivateKeyHex));
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: (config.entryPointAddress as Address) || entryPoint07Address,
      version: "0.7",
    },
  });

  const userOpForBundler = sanitizeUserOpForBundler(preparedUserOp);
  const signature = await account.signUserOperation(userOpForBundler as never);
  const signedUserOpForBundler = {
    ...userOpForBundler,
    signature,
  };

  const res = await fetch(config.bundlerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stringifyRpcPayload({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendUserOperation",
      params: [signedUserOpForBundler, config.entryPointAddress],
    }),
  });

  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (json.error) throw new Error(`Bundler: ${json.error.message ?? JSON.stringify(json.error)}`);
  const userOpHash = json.result;
  if (!userOpHash || typeof userOpHash !== "string") {
    throw new Error("Bundler did not return userOpHash");
  }

  const bundlerReceiptClient = createPublicClient({
    chain,
    transport: http(config.bundlerUrl, { timeout: BUNDLER_TIMEOUT_MS }),
  });

  const receipt = await waitForReceiptResilient(
    bundlerReceiptClient as Parameters<typeof sendUserOperation>[0],
    userOpHash as `0x${string}`
  );
  return (receipt?.receipt.transactionHash ?? userOpHash) as `0x${string}`;
}

/**
 * Submits only the USDC approve UserOp (bootstrap for paymaster).
 * Use before submitPreparedUserOp(registerPublicKey) when using custom sponsor flow.
 */
export async function submitApproveOnly(
  config: AaConfig,
  op: { ownerPrivateKeyHex: `0x${string}` }
): Promise<`0x${string}`> {
  const chain = defineChain({
    id: config.chainId,
    name: "Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
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
  return sendAndWait(smartAccountClient, {
    calls: [{ to: config.usdcAddress as Address, value: 0n, data: approveData }],
  });
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
 * Submits registerUsername via AA.
 */
export async function submitRegisterUsername(
  config: AaConfig,
  op: RegisterUsernameOp
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

  const registerData = encodeFunctionData({
    abi: parseAbi(["function registerUsername(string username)"]),
    functionName: "registerUsername",
    args: [op.username],
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
