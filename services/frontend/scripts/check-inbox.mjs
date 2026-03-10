#!/usr/bin/env node
/**
 * Check inbox for a recipient address.
 * Usage: node scripts/check-inbox.mjs <recipient_address> [rpc_url]
 */
import { createPublicClient, http } from "viem";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipient = process.argv[2];
const rpcUrl = process.argv[3] ?? process.env.TOOLS_RPC_URL ?? "http://127.0.0.1:8545";

if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
  console.error("Usage: node scripts/check-inbox.mjs <0x...recipient> [rpc_url]");
  process.exit(1);
}

const projectRoot = join(__dirname, "../..");
const mailAddressFile = process.env.TOOLS_MAIL_ADDRESS_FILE ?? join(projectRoot, "deploy-output", "mail-address.txt");
let mailAddress = "0xFa9f8B5D7Ca9122447c6E963fd056aED3d0AcA55";
let chainId = parseInt(process.env.TOOLS_CHAIN_ID ?? process.env.VITE_CHAIN_ID ?? "31337", 10);
try {
  const addr = readFileSync(mailAddressFile, "utf8").trim();
  if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) mailAddress = addr;
} catch {
  // use default
}

const PRIVATE_MAIL_ABI = [
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
];

const client = createPublicClient({
  transport: http(rpcUrl),
  chain: { id: chainId, name: "local", nativeCurrency: { decimals: 18 }, rpcUrls: {} },
});

const logsFiltered = await client.getContractEvents({
  address: mailAddress,
  abi: PRIVATE_MAIL_ABI,
  eventName: "MessageSent",
  args: { recipient: recipient.toLowerCase() },
});

const logsAll = await client.getContractEvents({
  address: mailAddress,
  abi: PRIVATE_MAIL_ABI,
  eventName: "MessageSent",
});

const ids = logsFiltered
  .map((l) => l.args.messageId)
  .filter((id) => id !== undefined)
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

console.log(`Inbox for ${recipient}: ${ids.length} message(s)`);
console.log(`Contract: ${mailAddress}, RPC: ${rpcUrl}`);

if (logsAll.length > 0 && ids.length === 0) {
  console.log(`(Contract has ${logsAll.length} total MessageSent - none to this recipient)`);
  for (const l of logsAll) {
    console.log(`  - msg #${l.args.messageId}: sender=${l.args.sender} recipient=${l.args.recipient}`);
  }
}

if (logsAll.length === 0) {
  const alt = "0x04318847963475999254Ca963682027e511C4Cb4";
  if (alt.toLowerCase() !== mailAddress.toLowerCase()) {
    const altLogs = await client.getContractEvents({
      address: alt,
      abi: PRIVATE_MAIL_ABI,
      eventName: "MessageSent",
    });
    if (altLogs.length > 0) {
      console.log(`\nFound ${altLogs.length} MessageSent on alternate contract ${alt}:`);
      for (const l of altLogs) {
        const toRecip = l.args.recipient?.toLowerCase() === recipient.toLowerCase();
        console.log(`  - msg #${l.args.messageId}: from ${l.args.sender} to ${l.args.recipient}${toRecip ? " <-- inbox" : ""}`);
      }
    }
  }
}

for (const id of ids) {
  const msg = await client.readContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    functionName: "getMessage",
    args: [id],
  });
  const cipherLen = typeof msg.ciphertext === "string" ? msg.ciphertext.length / 2 - 1 : msg.ciphertext.length;
  console.log(`  #${id}: from ${msg.sender} at ${msg.timestamp} (ciphertext ${cipherLen} bytes)`);
}
