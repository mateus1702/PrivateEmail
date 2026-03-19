import {
  createPublicClient,
  http,
  getContract,
  parseAbi,
  type Address,
  type Hash,
} from "viem";
import type { ContractsConfig } from "./config";

const USDC_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export interface Message {
  sender: Address;
  recipient: Address;
  ciphertext: `0x${string}`;
  ciphertextRef: bigint;
  timestamp: bigint;
  contentHash: Hash;
}

const PRIVATE_MAIL_ABI = [
  {
    inputs: [{ name: "pubKey", type: "bytes", internalType: "bytes" }],
    name: "registerPublicKey",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "username", type: "string", internalType: "string" }],
    name: "registerUsername",
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
    name: "getPage",
    outputs: [
      { name: "messageIds", type: "uint256[10]", internalType: "uint256[10]" },
      { name: "count", type: "uint8", internalType: "uint8" },
      { name: "prevPageIdForRecipient", type: "uint256", internalType: "uint256" },
    ],
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
    name: "getPublicKey",
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "username", type: "string", internalType: "string" }],
    name: "getAddressForUsername",
    outputs: [{ name: "", type: "address", internalType: "address" }],
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
  {
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    name: "usernameOf",
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function createMailClient(config: ContractsConfig, rpcUrl: string) {
  const chainId = config.chainId;
  const client = createPublicClient({
    transport: http(rpcUrl),
    chain: {
      id: chainId,
      name: "unknown",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
  });

  return getContract({
    address: config.PrivateMail.address as Address,
    abi: PRIVATE_MAIL_ABI,
    client,
  });
}

export interface InboxPage {
  messages: Message[];
  prevPageId: bigint;
  hasMore: boolean;
}

/** Load one page of inbox (up to 10 messages). pageId 0 = head page. */
export async function loadInboxPage(
  config: ContractsConfig,
  rpcUrl: string,
  recipient: Address,
  pageId: bigint
): Promise<InboxPage> {
  const contract = createMailClient(config, rpcUrl);
  const effectivePageId =
    pageId === 0n ? await contract.read.getRecipientHeadPageId([recipient]) : pageId;

  if (effectivePageId === 0n) {
    return { messages: [], prevPageId: 0n, hasMore: false };
  }

  const result = (await contract.read.getPageWithMessages([effectivePageId])) as unknown as [
    number,
    bigint,
    Array<{
      sender: string;
      recipient: string;
      ciphertext: string | Uint8Array;
      ciphertextRef: bigint;
      timestamp: bigint;
      contentHash: string;
    }>,
  ];
  const [count, prevPageId, pageMessages] = result;
  const n = Number(count);
  const messages: Message[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = pageMessages[i]!;
    const ct =
      typeof m.ciphertext === "string"
        ? (m.ciphertext as `0x${string}`)
        : (`0x${Array.from(m.ciphertext as Uint8Array)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}` as `0x${string}`);
    messages.push({
      sender: m.sender as Address,
      recipient: m.recipient as Address,
      ciphertext: ct,
      ciphertextRef: m.ciphertextRef,
      timestamp: m.timestamp,
      contentHash: m.contentHash as Hash,
    });
  }

  return {
    messages,
    prevPageId,
    hasMore: prevPageId !== 0n,
  };
}

export async function getUsdcBalance(
  rpcUrl: string,
  usdcAddress: Address,
  accountAddress: Address
): Promise<bigint> {
  const client = createPublicClient({
    transport: http(rpcUrl),
    chain: {
      id: 137,
      name: "unknown",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
  });
  const usdc = getContract({
    address: usdcAddress,
    abi: USDC_ABI,
    client,
  });
  return usdc.read.balanceOf([accountAddress]);
}

export async function isRegistered(
  config: ContractsConfig,
  rpcUrl: string,
  accountAddress: Address
): Promise<boolean> {
  const contract = createMailClient(config, rpcUrl);
  return contract.read.isRegistered([accountAddress]) as Promise<boolean>;
}

export async function getFullCiphertext(
  config: ContractsConfig,
  rpcUrl: string,
  msg: Message
): Promise<`0x${string}`> {
  if (msg.ciphertextRef > 0n) {
    const contract = createMailClient(config, rpcUrl);
    const large = await contract.read.getLargeCiphertext([msg.ciphertextRef]);
    return typeof large === "string"
      ? (large as `0x${string}`)
      : (`0x${Array.from(large as Uint8Array)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}` as `0x${string}`);
  }
  return msg.ciphertext;
}

interface RawMessage {
  sender: string;
  recipient: string;
  ciphertext: string | Uint8Array;
  ciphertextRef: bigint;
  timestamp: bigint;
  contentHash: string;
}

export async function fetchMessage(
  config: ContractsConfig,
  rpcUrl: string,
  messageId: bigint
): Promise<Message> {
  const contract = createMailClient(config, rpcUrl);
  const msg = (await contract.read.getMessage([messageId])) as RawMessage | null;
  if (!msg) throw new Error("Message not found");

  let ciphertext: `0x${string}`;
  if (msg.ciphertextRef > 0n) {
    const large = await contract.read.getLargeCiphertext([msg.ciphertextRef]);
    ciphertext =
      typeof large === "string"
        ? (large as `0x${string}`)
        : (`0x${Array.from(large as Uint8Array)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}` as `0x${string}`);
  } else {
    ciphertext =
      typeof msg.ciphertext === "string"
        ? (msg.ciphertext as `0x${string}`)
        : (`0x${Array.from(msg.ciphertext as Uint8Array)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}` as `0x${string}`);
  }

  return {
    sender: msg.sender as Address,
    recipient: msg.recipient as Address,
    ciphertext,
    ciphertextRef: msg.ciphertextRef,
    timestamp: msg.timestamp,
    contentHash: msg.contentHash as Hash,
  };
}

export async function getAddressForUsername(
  config: ContractsConfig,
  rpcUrl: string,
  username: string
): Promise<Address | null> {
  const contract = createMailClient(config, rpcUrl);
  const addr = await contract.read.getAddressForUsername([username]);
  if (addr === "0x0000000000000000000000000000000000000000" || !addr) return null;
  return addr as Address;
}

/** Fetch the username for an address via the usernameOf mapping (direct contract read). */
export async function getUsernameForAddress(
  config: ContractsConfig,
  rpcUrl: string,
  ownerAddress: Address
): Promise<string | null> {
  const contract = createMailClient(config, rpcUrl);
  const username = await contract.read.usernameOf([ownerAddress]);
  if (!username || username.length === 0) return null;
  return username;
}
