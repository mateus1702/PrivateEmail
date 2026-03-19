#!/usr/bin/env node
/**
 * Extract MATIC from an ERC-4337 EntryPoint v0.7 deposit.
 * Uses withdrawTo() to transfer deposited balance to a destination address.
 *
 * Usage:
 *   npm run run   # Dry-run: show balance only
 *   npm run run -- --execute   # Actually withdraw to destination
 *
 * Configure via hardcoded variables below.
 */
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  formatUnits,
  parseAbi,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

// =============================================================================
// HARDCODED CONFIGURATION – Edit these before running
// =============================================================================

const RPC_URL = "https://rpc.ankr.com/polygon/8ffa854920faddd72150c936d7563e370d556d26045476cb1366c69453035378";
const ENTRYPOINT_ADDRESS: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
/** Private key of the account that has the deposit in the EntryPoint (e.g. ALTO_UTILITY or paymaster signer) */
const SENDER_PRIVATE_KEY = "0x4ab5f6831e7fd2447eff6a43b8c4bef0a7d46c91adcaafb376948ca1aa3fcf0a"; // Replace with actual key
/** Address to receive the withdrawn MATIC */
const DESTINATION_ADDRESS: Address = "0xc0e19F7E14C6A476Ff399743bA5CB37069e1b1E3"; // Replace with actual address

// =============================================================================

const POLYGON_MAINNET: Chain = {
  ...polygon,
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
};

const ENTRYPOINT_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function withdrawTo(address withdrawAddress, uint256 withdrawAmount) nonpayable",
]);

function parseArgs(argv: string[]): { execute: boolean } {
  return { execute: argv.includes("--execute") };
}

async function main() {
  const { execute } = parseArgs(process.argv.slice(2));

  if (
    !SENDER_PRIVATE_KEY ||
    SENDER_PRIVATE_KEY === "0x..." ||
    !/^0x[a-fA-F0-9]{64}$/.test(SENDER_PRIVATE_KEY.trim())
  ) {
    console.error("Edit SENDER_PRIVATE_KEY in the source with the account that has the EntryPoint deposit.");
    process.exit(1);
  }
  if (!DESTINATION_ADDRESS || DESTINATION_ADDRESS === "0x...") {
    console.error("Edit DESTINATION_ADDRESS in the source with the recipient address.");
    process.exit(1);
  }

  const account = privateKeyToAccount(SENDER_PRIVATE_KEY.trim() as `0x${string}`);
  const transport = http(RPC_URL);

  const publicClient = createPublicClient({
    chain: POLYGON_MAINNET,
    transport,
  });

  const entryPoint = getContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    client: publicClient,
  });

  const balance = await entryPoint.read.balanceOf([account.address]);
  const maticFormatted = formatUnits(balance, 18);

  console.log("\n=== EntryPoint Deposit (Polygon) ===\n");
  console.log(`  EntryPoint:      ${ENTRYPOINT_ADDRESS}`);
  console.log(`  Account:        ${account.address}`);
  console.log(`  Deposited:      ${maticFormatted} MATIC`);
  console.log(`  Destination:    ${DESTINATION_ADDRESS}`);
  console.log();

  if (balance === 0n) {
    console.log("  No balance to withdraw.");
    return;
  }

  if (!execute) {
    console.log("  Dry run. To withdraw, run:");
    console.log("    npm run run -- --execute");
    console.log();
    return;
  }

  const walletClient = createWalletClient({
    chain: POLYGON_MAINNET,
    transport,
    account,
  });

  const entryPointWithWallet = getContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  console.log(`  Withdrawing ${maticFormatted} MATIC to ${DESTINATION_ADDRESS}...`);
  const hash = await entryPointWithWallet.write.withdrawTo([
    DESTINATION_ADDRESS,
    balance,
  ]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Tx: ${hash} (status: ${receipt.status})`);
  console.log("\n  Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
