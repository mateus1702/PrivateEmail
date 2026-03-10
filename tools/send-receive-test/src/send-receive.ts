#!/usr/bin/env node
/**
 * Send-receive test: end-to-end encrypted message via PrivateMail contract.
 * Registers sender and recipient, sends a message, fetches and decrypts it.
 * On Anvil (e.g. Polygon fork), funds test accounts with USDC from whales.
 * Usage: npm run run [--message "optional text"]
 */
import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  encodeFunctionData,
  http,
  parseUnits,
  keccak256,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  deriveEncryptionKeyPair,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  bytesToHex,
  hexToBytes,
} from "./crypto.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..", "..");
config({ path: join(projectRoot, ".env") });

// ========== ENV (loaded from .env; no defaults in code) ==========
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env for send-receive test: ${name}. Set it in .env (SEND-RECEIVE TEST section).`);
  }
  return value.trim();
}

const rawMailAddressFile = requireEnv("TOOLS_MAIL_ADDRESS_FILE", process.env.TOOLS_MAIL_ADDRESS_FILE);
const ENV = {
  RPC_URL: requireEnv("TOOLS_RPC_URL", process.env.TOOLS_RPC_URL),
  CHAIN_ID: requireEnv("TOOLS_CHAIN_ID", process.env.TOOLS_CHAIN_ID),
  MAIL_ADDRESS_FILE: rawMailAddressFile.startsWith("/") || /^[a-zA-Z]:/.test(rawMailAddressFile)
    ? rawMailAddressFile
    : join(projectRoot, rawMailAddressFile),
  MNEMONIC: requireEnv("CONTRACT_DEPLOYER_MNEMONIC", process.env.CONTRACT_DEPLOYER_MNEMONIC),
  MESSAGE: requireEnv("TOOLS_MESSAGE", process.env.TOOLS_MESSAGE),
  USDC_ADDRESS: requireEnv("TOOLS_USDC_ADDRESS", process.env.TOOLS_USDC_ADDRESS ?? process.env.VITE_USDC_ADDRESS) as Address,
  USDC_FUND_AMOUNT: parseUnits(requireEnv("TOOLS_USDC_FUND_AMOUNT", process.env.TOOLS_USDC_FUND_AMOUNT), 6),
  WHALE_CANDIDATES: requireEnv("TOOLS_ANVIL_WHALE_CANDIDATES", process.env.TOOLS_ANVIL_WHALE_CANDIDATES ?? process.env.VITE_ANVIL_WHALE_CANDIDATES)
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean) as Address[],
};
// ========================================================================================

const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
] as const;

const PRIVATE_MAIL_ABI = [
  {
    inputs: [{ name: "pubKey", type: "bytes", internalType: "bytes" }],
    name: "registerPublicKey",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "recipient", type: "address", internalType: "address" },
      { name: "ciphertext", type: "bytes", internalType: "bytes" },
      { name: "contentHash", type: "bytes32", internalType: "bytes32" },
    ],
    name: "sendMessage",
    outputs: [{ name: "messageId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "messageId", type: "uint256", internalType: "uint256" }],
    name: "getMessage",
    outputs: [
      {
        components: [
          { name: "sender", type: "address", internalType: "address" },
          { name: "recipient", type: "address", internalType: "address" },
          { name: "ciphertext", type: "bytes", internalType: "bytes" },
          { name: "ciphertextRef", type: "uint256", internalType: "uint256" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "contentHash", type: "bytes32", internalType: "bytes32" },
        ],
        name: "",
        type: "tuple",
        internalType: "struct PrivateMail.Message",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "refId", type: "uint256", internalType: "uint256" }],
    name: "getLargeCiphertext",
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "recipient", type: "address", internalType: "address" }],
    name: "getRecipientHeadPageId",
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "pageId", type: "uint256", internalType: "uint256" }],
    name: "getPageWithMessages",
    outputs: [
      { name: "count", type: "uint8", internalType: "uint8" },
      { name: "prevPageIdForRecipient", type: "uint256", internalType: "uint256" },
      {
        name: "pageMessages",
        type: "tuple[10]",
        internalType: "struct PrivateMail.Message[10]",
        components: [
          { name: "sender", type: "address", internalType: "address" },
          { name: "recipient", type: "address", internalType: "address" },
          { name: "ciphertext", type: "bytes", internalType: "bytes" },
          { name: "ciphertextRef", type: "uint256", internalType: "uint256" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "contentHash", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    name: "isRegistered",
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function parseArgs(): { message: string; rpcUrl: string } {
  const args = process.argv.slice(2);
  let message = ENV.MESSAGE;
  let rpcUrl = ENV.RPC_URL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--message" && args[i + 1]) {
      message = args[++i];
    } else if (args[i] === "--rpc" && args[i + 1]) {
      rpcUrl = args[++i];
    }
  }
  return { message, rpcUrl };
}

function loadMailAddress(): Address {
  const mailAddressFile = ENV.MAIL_ADDRESS_FILE;
  if (!existsSync(mailAddressFile)) {
    throw new Error(
      `Mail contract address file not found: ${mailAddressFile}. Run deploy first (cd contracts && npm run deploy:localhost).`
    );
  }
  const addr = readFileSync(mailAddressFile, "utf8").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error(`Invalid mail address in ${mailAddressFile}`);
  }
  return addr as Address;
}

async function detectAnvil(rpcUrl: string): Promise<boolean> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "anvil_impersonateAccount",
        params: ["0x0000000000000000000000000000000000000001"],
      }),
    });
    const json = (await res.json()) as { error?: { message: string } };
    if (json.error) return false;
    await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "anvil_stopImpersonatingAccount",
        params: ["0x0000000000000000000000000000000000000001"],
      }),
    });
    return true;
  } catch {
    return false;
  }
}

async function fundWithUsdc(
  rpcUrl: string,
  publicClient: ReturnType<typeof createPublicClient>,
  accountAddress: Address
): Promise<void> {
  const usdc = getContract({
    address: ENV.USDC_ADDRESS,
    abi: USDC_ABI,
    client: publicClient,
  });
  const balance = await usdc.read.balanceOf([accountAddress]);
  if (balance >= parseUnits("1", 6)) {
    console.log(`  ${accountAddress.slice(0, 10)}... already has ${balance} USDC, skipping`);
    return;
  }

  let whale: Address | undefined;
  for (const candidate of ENV.WHALE_CANDIDATES) {
    const bal = await usdc.read.balanceOf([candidate]);
    if (bal >= ENV.USDC_FUND_AMOUNT) {
      whale = candidate;
      break;
    }
  }
  if (!whale) {
    throw new Error("No whale has enough USDC. Use Polygon fork (anvil --fork-url <polygon_rpc>).");
  }

  await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "anvil_impersonateAccount",
      params: [whale],
    }),
  });

  await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "anvil_setBalance",
      params: [whale, "0x" + BigInt(1e18).toString(16)],
    }),
  });

  const transferData = encodeFunctionData({
    abi: USDC_ABI,
    functionName: "transfer",
    args: [accountAddress, ENV.USDC_FUND_AMOUNT],
  });

  const txRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "eth_sendTransaction",
      params: [
        {
          from: whale,
          to: ENV.USDC_ADDRESS,
          data: transferData,
          gas: "0x186A0",
        },
      ],
    }),
  });
  const txJson = (await txRes.json()) as { error?: { message: string }; result?: string };
  if (txJson.error) {
    throw new Error(`USDC transfer failed: ${txJson.error.message}`);
  }

  await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "anvil_stopImpersonatingAccount",
      params: [whale],
    }),
  });

  const after = await usdc.read.balanceOf([accountAddress]);
  console.log(`  Funded ${accountAddress.slice(0, 10)}... with USDC, balance: ${after}`);
}

async function setEthBalance(rpcUrl: string, address: Address, valueWei: bigint): Promise<void> {
  await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "anvil_setBalance",
      params: [address, "0x" + valueWei.toString(16)],
    }),
  });
}

function deriveAccountFromMnemonic(
  mnemonic: string,
  index: number
): { address: Address; privateKeyBytes: Uint8Array } {
  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(`m/44'/60'/0'/0/${index}`);
  const privateKeyBytes = derived.privateKey!;
  const hexKey =
    "0x" +
    Array.from(privateKeyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const account = privateKeyToAccount(hexKey as `0x${string}`);
  return { address: account.address, privateKeyBytes };
}

async function main() {
  const { message, rpcUrl } = parseArgs();

  const chainId = parseInt(ENV.CHAIN_ID, 10);
  const mnemonic = ENV.MNEMONIC;

  const mailAddress = loadMailAddress();
  console.log(`Mail contract: ${mailAddress}`);
  console.log(`RPC: ${rpcUrl}, chainId: ${chainId}`);

  const chain = {
    id: chainId,
    name: "local",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletTransport = http(rpcUrl);

  const code = await publicClient.getCode({ address: mailAddress });
  if (!code || code === "0x") {
    throw new Error(
      `No contract code at ${mailAddress} on RPC ${rpcUrl}. ` +
        "Make sure deploy-output/mail-address.txt matches the selected network."
    );
  }

  const sender = deriveAccountFromMnemonic(mnemonic, 0);
  const recipient = deriveAccountFromMnemonic(mnemonic, 1);

  const senderEnc = deriveEncryptionKeyPair(sender.privateKeyBytes);
  const recipientEnc = deriveEncryptionKeyPair(recipient.privateKeyBytes);

  const walletSender = createWalletClient({
    account: privateKeyToAccount(
      ("0x" +
        Array.from(sender.privateKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")) as `0x${string}`
    ),
    chain,
    transport: walletTransport,
  });

  console.log(`Sender: ${sender.address}`);
  console.log(`Recipient: ${recipient.address}`);

  const isAnvil = await detectAnvil(rpcUrl);
  if (isAnvil) {
    console.log("Anvil detected. Funding test accounts with ETH and USDC from whales...");
    await setEthBalance(rpcUrl, sender.address, BigInt(1e18));
    await setEthBalance(rpcUrl, recipient.address, BigInt(1e18));
    await fundWithUsdc(rpcUrl, publicClient, sender.address);
    await fundWithUsdc(rpcUrl, publicClient, recipient.address);
  }

  const isSenderReg = await publicClient.readContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    functionName: "isRegistered",
    args: [sender.address],
  });
  if (!isSenderReg) {
    console.log("Registering sender...");
    const hash = await walletSender.writeContract({
      address: mailAddress,
      abi: PRIVATE_MAIL_ABI,
      functionName: "registerPublicKey",
      args: [bytesToHex(senderEnc.publicKey) as `0x${string}`],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Registered sender (tx ${hash})`);
  }

  const isRecipientReg = await publicClient.readContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    functionName: "isRegistered",
    args: [recipient.address],
  });
  if (!isRecipientReg) {
    const recipientWallet = createWalletClient({
      account: privateKeyToAccount(
        ("0x" +
          Array.from(recipient.privateKeyBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")) as `0x${string}`
      ),
      chain,
      transport: walletTransport,
    });
    console.log("Registering recipient...");
    const hash = await recipientWallet.writeContract({
      address: mailAddress,
      abi: PRIVATE_MAIL_ABI,
      functionName: "registerPublicKey",
      args: [bytesToHex(recipientEnc.publicKey) as `0x${string}`],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Registered recipient (tx ${hash})`);
  }

  const plaintext = new TextEncoder().encode(message);
  const contentHash = keccak256(plaintext);
  const { ciphertext } = encryptWithPublicKey(plaintext, recipientEnc.publicKey);
  const ciphertextHex = bytesToHex(ciphertext) as `0x${string}`;

  console.log("Sending message...");
  const txHash = await walletSender.writeContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    functionName: "sendMessage",
    args: [recipient.address, ciphertextHex, contentHash],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Sent (tx ${txHash})`);

  const headPageId = await publicClient.readContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    functionName: "getRecipientHeadPageId",
    args: [recipient.address],
  });

  if (headPageId === 0n) {
    throw new Error("No inbox page found for recipient");
  }

  const pageResult = await publicClient.readContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    functionName: "getPageWithMessages",
    args: [headPageId],
  });
  const count = pageResult[0];
  const pageMessages = pageResult[2];
  const n = Number(count);
  if (n === 0) {
    throw new Error("Inbox page empty");
  }

  const latestMsg = pageMessages[n - 1];
  let fullCiphertextHex: `0x${string}`;
  if (latestMsg.ciphertextRef > 0n) {
    const large = await publicClient.readContract({
      address: mailAddress,
      abi: PRIVATE_MAIL_ABI,
      functionName: "getLargeCiphertext",
      args: [latestMsg.ciphertextRef],
    });
    fullCiphertextHex =
      typeof large === "string"
        ? (large as `0x${string}`)
        : (`0x${Array.from(large as Uint8Array)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}` as `0x${string}`);
  } else {
    const ct = latestMsg.ciphertext;
    fullCiphertextHex =
      typeof ct === "string"
        ? (ct as `0x${string}`)
        : (`0x${Array.from(ct as Uint8Array)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}` as `0x${string}`);
  }

  const ciphertextBytes = hexToBytes(fullCiphertextHex);
  const decrypted = decryptWithPrivateKey(ciphertextBytes, recipientEnc.privateKey);
  const decryptedText = new TextDecoder().decode(decrypted);
  const decryptedHash = keccak256(decrypted);

  if (decryptedHash !== latestMsg.contentHash) {
    throw new Error(
      `Content hash mismatch: expected ${latestMsg.contentHash}, got ${decryptedHash}`
    );
  }

  console.log(`SUCCESS: Sent and received message: "${decryptedText}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
