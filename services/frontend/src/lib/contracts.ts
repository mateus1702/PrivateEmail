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
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    name: "getPublicKey",
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
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
    inputs: [],
    name: "nextMessageId",
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "pubKey", type: "bytes" },
    ],
    name: "PublicKeyRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "messageId", type: "uint256" },
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "contentHash", type: "bytes32" },
    ],
    name: "MessageSent",
    type: "event",
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

export async function getInboxMessageIds(
  config: ContractsConfig,
  rpcUrl: string,
  recipient: Address
): Promise<bigint[]> {
  const client = createPublicClient({
    transport: http(rpcUrl),
    chain: {
      id: config.chainId,
      name: "unknown",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
  });

  // Get current block number
  const latestBlock = await client.getBlockNumber();
  const startBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;

  // Query events in chunks of 1000 blocks to avoid Ankr's 1024 block limit
  const allLogs: any[] = [];
  const chunkSize = 1000n;

  for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += chunkSize) {
    const toBlock = fromBlock + chunkSize - 1n > latestBlock ? latestBlock : fromBlock + chunkSize - 1n;

    try {
      const logs = await client.getContractEvents({
        address: config.PrivateMail.address as Address,
        abi: PRIVATE_MAIL_ABI,
        eventName: "MessageSent",
        args: { recipient },
        fromBlock,
        toBlock,
      });

      allLogs.push(...logs);
    } catch (error) {
      // If chunk fails, try with smaller chunks or skip
      console.warn(`Failed to query events from ${fromBlock} to ${toBlock}:`, error);
    }
  }

  const ids = allLogs
    .map((l) => l.args.messageId)
    .filter((id): id is bigint => id !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return ids;
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
  return contract.read.isRegistered([accountAddress]);
}

export async function fetchMessage(
  config: ContractsConfig,
  rpcUrl: string,
  messageId: bigint
): Promise<Message> {
  const contract = createMailClient(config, rpcUrl);
  const msg = await contract.read.getMessage([messageId]);
  if (!msg) throw new Error("Message not found");
  return {
    sender: msg.sender,
    recipient: msg.recipient,
    ciphertext: msg.ciphertext,
    timestamp: msg.timestamp,
    contentHash: msg.contentHash,
  };
}
