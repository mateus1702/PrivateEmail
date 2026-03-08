/**
 * Test: Create 2 accounts, register both, send a message from one to the other, receive it.
 * Prereqs: AA stack (anvil, bundler, paymaster) + contract deployed.
 *
 * Run: npm run test (from tools/send-receive-test)
 * Env: RPC_URL, BUNDLER_URL, PAYMASTER_URL, USDC_ADDRESS, CHAIN_ID (optional)
 */
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSimpleSmartAccount } from "permissionless/accounts";
import {
  createPublicClient,
  createTestClient,
  defineChain,
  encodeFunctionData,
  getContract,
  http,
  keccak256,
  parseAbi,
  parseUnits,
  toHex,
  type Address,
} from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const BUNDLER_URL = process.env.BUNDLER_URL ?? "http://127.0.0.1:4337";
const PAYMASTER_URL = process.env.PAYMASTER_URL ?? "http://127.0.0.1:3000";
const USDC_ADDRESS = (process.env.USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;
const CHAIN_ID = parseInt(process.env.CHAIN_ID ?? "137", 10); // Use 137 for Polygon fork
const FUNDING_AMOUNT = parseUnits(process.env.USDC_FUND_AMOUNT ?? "10", 6);

// Anvil account #0 (alice/sender) and #1 (bob/recipient)
const ALICE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const BOB_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`;

const USDC_APPROVE_AMOUNT = parseUnits("1000000", 6);

const WHALE_CANDIDATES = [
  "0x47c031236e19d024b42f8de678d3110562d925b5",
  "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  "0x28C6c06298d514Db089934071355E5743bf21d60",
] as Address[];

const PRIVATE_MAIL_ABI = [
  {
    type: "function",
    name: "registerPublicKey",
    inputs: [{ name: "pubKey", type: "bytes", internalType: "bytes" }],
  },
  {
    type: "function",
    name: "sendMessage",
    inputs: [
      { name: "recipient", type: "address", internalType: "address" },
      { name: "ciphertext", type: "bytes", internalType: "bytes" },
      { name: "contentHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "getMessage",
    inputs: [{ name: "messageId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        type: "tuple",
        internalType: "struct PrivateMail.Message",
        components: [
          { name: "sender", type: "address", internalType: "address" },
          { name: "recipient", type: "address", internalType: "address" },
          { name: "ciphertext", type: "bytes", internalType: "bytes" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "contentHash", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MessageSent",
    inputs: [
      { name: "messageId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "sender", type: "address", indexed: true, internalType: "address" },
      { name: "recipient", type: "address", indexed: true, internalType: "address" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "contentHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
  },
] as const;

const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

function loadConfig(): { mailAddress: Address; chainId: number } {
  const cfgPath = join(__dirname, "../../../services/frontend/public/config/contracts.json");
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    const addr = cfg?.PrivateMail?.address;
    if (!addr) throw new Error("Missing PrivateMail.address in contracts.json");
    return {
      mailAddress: addr as Address,
      chainId: cfg.chainId ?? CHAIN_ID,
    };
  } catch (e) {
    throw new Error(`Failed to load contracts.json from ${cfgPath}: ${(e as Error).message}`);
  }
}

async function resolvePaymasterAddress(): Promise<Address> {
  const base = PAYMASTER_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/paymaster-address`);
  if (!res.ok) throw new Error(`Paymaster API unreachable: ${res.status}`);
  const json = (await res.json()) as { paymasterAddress?: string };
  const addr = json.paymasterAddress?.trim();
  if (!addr) throw new Error("Paymaster API did not return paymaster address");
  return addr as Address;
}

async function fundWithUsdc(
  publicClient: ReturnType<typeof createPublicClient>,
  testClient: ReturnType<typeof createTestClient>,
  accountAddress: Address
): Promise<void> {
  const usdc = getContract({ address: USDC_ADDRESS, abi: USDC_ABI, client: publicClient });
  const balance = await usdc.read.balanceOf([accountAddress]);
  if (balance >= parseUnits("1", 6)) {
    console.log(`  Already has ${balance} USDC, skipping fund`);
    return;
  }

  let whale: Address | undefined;
  for (const candidate of WHALE_CANDIDATES) {
    const bal = await usdc.read.balanceOf([candidate]);
    if (bal >= FUNDING_AMOUNT) {
      whale = candidate;
      break;
    }
  }
  if (!whale) throw new Error("No whale has enough USDC. Use Polygon fork (anvil --fork-url)");

  await testClient.impersonateAccount({ address: whale });
  await testClient.setBalance({ address: whale, value: BigInt(1e18) });

  const transferData = encodeFunctionData({
    abi: USDC_ABI,
    functionName: "transfer",
    args: [accountAddress, FUNDING_AMOUNT],
  });
  await publicClient.request({
    method: "eth_sendTransaction",
    params: [{ from: whale, to: USDC_ADDRESS, data: transferData, gas: "0x186A0" }],
  } as never);

  await testClient.stopImpersonatingAccount({ address: whale });
  const after = await usdc.read.balanceOf([accountAddress]);
  console.log(`  Funded with USDC, balance now: ${after}`);
}

async function register(
  publicClient: ReturnType<typeof createPublicClient>,
  paymasterAddress: Address,
  ownerKey: `0x${string}`,
  mailAddress: Address,
  chainId: number
): Promise<void> {
  try {
    const chain = defineChain({
      id: chainId,
      name: chainId === 137 ? "Polygon" : "Local Chain",
      nativeCurrency: chainId === 137
        ? { name: "MATIC", symbol: "MATIC", decimals: 18 }
        : { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    });
    const paymasterClient = createPimlicoClient({
      entryPoint: { address: entryPoint07Address, version: "0.7" },
      transport: http(PAYMASTER_URL),
    });
    const owner = privateKeyToAccount(ownerKey);
    const account = await toSimpleSmartAccount({
      client: publicClient,
      owner,
      entryPoint: { address: entryPoint07Address, version: "0.7" },
    });
    const smartAccountClient = createSmartAccountClient({
      account,
      chain,
      bundlerTransport: http(BUNDLER_URL),
      paymaster: paymasterClient,
      userOperation: {
        estimateFeesPerGas: async () =>
          (await paymasterClient.getUserOperationGasPrice()).fast,
      },
    });

    const approveData = encodeFunctionData({
      abi: USDC_ABI,
      functionName: "approve",
      args: [paymasterAddress, USDC_APPROVE_AMOUNT],
    });
    await smartAccountClient.sendTransaction({
      calls: [{ to: USDC_ADDRESS, value: 0n, data: approveData }],
    });

    const pubKeyHex = ("0x04" + "a".repeat(128)) as `0x${string}`;
    const registerData = encodeFunctionData({
      abi: PRIVATE_MAIL_ABI,
      functionName: "registerPublicKey",
      args: [pubKeyHex],
    });
    await smartAccountClient.sendTransaction({
      calls: [{ to: mailAddress, value: 0n, data: registerData }],
    });
  } catch (e: any) {
    if (e.message?.includes("Bundler estimate failed") || e.message?.includes("paymaster")) {
      throw new Error(
        `Paymaster rejected UserOperation. The paymaster may not be configured to accept calls to the PrivateMail contract (${mailAddress}). ` +
        `Ensure the paymaster whitelist includes this contract address. Original error: ${e.message}`
      );
    }
    throw e;
  }
}

async function sendMessage(
  publicClient: ReturnType<typeof createPublicClient>,
  ownerKey: `0x${string}`,
  mailAddress: Address,
  recipient: Address,
  ciphertextHex: `0x${string}`,
  contentHash: `0x${string}`,
  chainId: number,
  paymasterAddress: Address
): Promise<`0x${string}`> {
  try {
    const chain = defineChain({
      id: chainId,
      name: chainId === 137 ? "Polygon" : "Local Chain",
      nativeCurrency: chainId === 137
        ? { name: "MATIC", symbol: "MATIC", decimals: 18 }
        : { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    });
    const paymasterClient = createPimlicoClient({
      entryPoint: { address: entryPoint07Address, version: "0.7" },
      transport: http(PAYMASTER_URL),
    });
    const owner = privateKeyToAccount(ownerKey);
    const account = await toSimpleSmartAccount({
      client: publicClient,
      owner,
      entryPoint: { address: entryPoint07Address, version: "0.7" },
    });
    const smartAccountClient = createSmartAccountClient({
      account,
      chain,
      bundlerTransport: http(BUNDLER_URL),
      paymaster: paymasterClient,
      userOperation: {
        estimateFeesPerGas: async () =>
          (await paymasterClient.getUserOperationGasPrice()).fast,
      },
    });

    const sendData = encodeFunctionData({
      abi: PRIVATE_MAIL_ABI,
      functionName: "sendMessage",
      args: [recipient, ciphertextHex, contentHash],
    });

    console.log("   Submitting UserOp to sendMessage...");
    console.log("   Call data:", sendData.slice(0, 100) + "...");

    const hash = await smartAccountClient.sendTransaction({
      calls: [{ to: mailAddress, value: 0n, data: sendData }],
    });

    console.log("   UserOp submitted successfully:", hash);

    // Check transaction receipt to verify execution
    console.log("   Checking transaction receipt...");
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      console.log(`   Transaction status: ${receipt.status}`);
      console.log(`   Block number: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
      console.log(`   Logs count: ${receipt.logs.length}`);

      // Check for contract execution logs
      const contractLogs = receipt.logs.filter(log =>
        log.address.toLowerCase() === mailAddress.toLowerCase()
      );
      console.log(`   Contract logs: ${contractLogs.length}`);

      if (contractLogs.length === 0) {
        console.warn("   ⚠️  WARNING: No logs from PrivateMail contract - call may have reverted!");
      }

      // Check for MessageSent events specifically
      const messageSentLogs = receipt.logs.filter(log =>
        log.topics[0] === "0xadf67e525d1556d0e0a61997ac1891dec92a21ba974328aa422695a91c27b1bf"
      );
      console.log(`   MessageSent events: ${messageSentLogs.length}`);

      if (receipt.status !== "success") {
        throw new Error(`Transaction reverted with status: ${receipt.status}`);
      }
    } catch (receiptError) {
      console.error("   Error checking receipt:", receiptError);
    }

    return hash;
  } catch (e: any) {
    if (e.message?.includes("Bundler estimate failed") || e.message?.includes("paymaster")) {
      throw new Error(
        `Paymaster rejected UserOperation. The paymaster may not be configured to accept calls to the PrivateMail contract (${mailAddress}). ` +
        `Ensure the paymaster whitelist includes this contract address. Original error: ${e.message}`
      );
    }
    throw e;
  }
}

async function main() {
  const { mailAddress, chainId } = loadConfig();
  const effectiveChainId = chainId ?? CHAIN_ID;

  const chain = defineChain({
    id: effectiveChainId,
    name: effectiveChainId === 137 ? "Polygon" : "Local Chain",
    nativeCurrency: effectiveChainId === 137
      ? { name: "MATIC", symbol: "MATIC", decimals: 18 }
      : { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });

  // Test contract connectivity
  console.log("Testing contract connectivity...");
  try {
    const code = await publicClient.getCode({ address: mailAddress });
    console.log(`Contract has ${code ? code.length : 0} bytes of code`);
  } catch (e) {
    console.log(`Contract code read error: ${e.message}`);
  }

  const testClient = createTestClient({
    chain,
    transport: http(RPC_URL),
    mode: "anvil",
  });

  const paymasterAddress = await resolvePaymasterAddress();

  const aliceOwner = privateKeyToAccount(ALICE_KEY);
  const bobOwner = privateKeyToAccount(BOB_KEY);

  const aliceAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: aliceOwner,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });
  const bobAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: bobOwner,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  console.log("=== Project5 send-receive test ===");
  console.log("Alice (sender):", aliceAccount.address);
  console.log("Bob (recipient):", bobAccount.address);
  console.log("PrivateMail:", mailAddress);
  console.log("");

  // 1. Fund both accounts
  console.log("1. Funding Alice with USDC...");
  await fundWithUsdc(publicClient, testClient, aliceAccount.address);
  console.log("2. Funding Bob with USDC...");
  await fundWithUsdc(publicClient, testClient, bobAccount.address);

  // 3. Register both (recipient must be registered before receiving)
  console.log("3. Registering Alice...");
  await register(publicClient, paymasterAddress, ALICE_KEY, mailAddress, effectiveChainId);
  console.log("4. Registering Bob...");
  await register(publicClient, paymasterAddress, BOB_KEY, mailAddress, effectiveChainId);

  // 5. Send message from Alice to Bob
  const plaintext = "Hello Bob from Alice!";
  const ciphertextHex = toHex(new TextEncoder().encode(plaintext)) as `0x${string}`;
  const contentHash = keccak256(ciphertextHex);
  console.log("5. Sending message from Alice to Bob...");
  console.log(`   From: ${aliceAccount.address}`);
  console.log(`   To: ${bobAccount.address}`);
  console.log(`   Contract: ${mailAddress}`);
  console.log(`   Ciphertext: ${ciphertextHex.slice(0, 20)}...`);
  console.log(`   Content hash: ${contentHash}`);

  const txHash = await sendMessage(
    publicClient,
    ALICE_KEY,
    mailAddress,
    bobAccount.address,
    ciphertextHex,
    contentHash,
    effectiveChainId,
    paymasterAddress
  );
  console.log("   Tx hash:", txHash);

  // 6. Receive: query MessageSent and getMessage
  console.log("   Querying MessageSent events for recipient:", bobAccount.address);

  // Get current block number and query in chunks to avoid Ankr's 1024 block limit
  const latestBlock = await publicClient.getBlockNumber();
  const startBlock = latestBlock > 2000n ? latestBlock - 2000n : 0n; // Look back 2000 blocks

  let logs: any[] = [];
  const chunkSize = 500n; // Use 500 block chunks (well under 1024 limit)

  for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += chunkSize) {
    const toBlock = fromBlock + chunkSize - 1n > latestBlock ? latestBlock : fromBlock + chunkSize - 1n;

    try {
      const chunkLogs = await publicClient.getContractEvents({
        address: mailAddress,
        abi: PRIVATE_MAIL_ABI,
        eventName: "MessageSent",
        args: { recipient: bobAccount.address },
        fromBlock,
        toBlock,
      });

      logs.push(...chunkLogs);
      console.log(`   Found ${chunkLogs.length} events in block range ${fromBlock}-${toBlock}`);
    } catch (error) {
      console.warn(`   Failed to query block range ${fromBlock}-${toBlock}:`, error.message);
    }
  }

  console.log(`   Total events found: ${logs.length}`);

  const ids = logs
    .map((l) => l.args.messageId)
    .filter((id): id is bigint => id !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  console.log("6. Bob's inbox:", ids.length, "message(s)");

  // Debug: Check transaction receipt and events
  console.log("   Checking transaction receipt...");
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    console.log(`   Transaction status: ${receipt.status}`);
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Logs count: ${receipt.logs.length}`);

    // Check all logs in the transaction
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      console.log(`   Log ${i}: address=${log.address}, topics=${log.topics.length}, data=${log.data.length} bytes`);
      if (log.topics.length > 0) {
        console.log(`     Topic 0: ${log.topics[0]}`);
      }
    }

    // Check for MessageSent events in the transaction logs
    const messageSentLogs = receipt.logs.filter(log =>
      log.topics[0] === "0xadf67e525d1556d0e0a61997ac1891dec92a21ba974328aa422695a91c27b1bf"
    );
    console.log(`   MessageSent events in tx: ${messageSentLogs.length}`);
  } catch (e) {
    console.log(`   Error checking receipt: ${e.message}`);
  }

  // Also check for any MessageSent events on the PrivateMail contract from recent blocks
  const latestBlock2 = await publicClient.getBlockNumber();
  const fromBlock2 = latestBlock2 > 500n ? latestBlock2 - 500n : 0n;

  const allEvents = await publicClient.getContractEvents({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    eventName: "MessageSent",
    fromBlock: fromBlock2,
    toBlock: "latest",
  });

  if (allEvents.length > 0) {
    console.log(`   Found ${allEvents.length} MessageSent events on contract:`);
    for (const event of allEvents.slice(0, 5)) { // Show first 5
      console.log(`     msg #${event.args.messageId} from ${event.args.sender} to ${event.args.recipient}`);
    }
    if (allEvents.length > 5) {
      console.log(`     ... and ${allEvents.length - 5} more`);
    }
  } else {
    console.log("   No MessageSent events found on contract in recent blocks");
  }

  const mail = getContract({
    address: mailAddress,
    abi: PRIVATE_MAIL_ABI,
    client: publicClient,
  });

  for (const id of ids) {
    const msg = await mail.read.getMessage([id]);
    const len = typeof msg.ciphertext === "string" ? msg.ciphertext.length / 2 - 1 : msg.ciphertext.length;
    console.log(`   #${id}: from ${msg.sender} at ${msg.timestamp} (${len} bytes ciphertext)`);
  }

  if (ids.length === 0) {
    console.error("FAIL: No messages in Bob's inbox");
    if (allEvents.length > 0) {
      console.error("But MessageSent events exist on other contracts. Check contract address in contracts.json");
    }
    process.exit(1);
  }
  const lastMsg = await mail.read.getMessage([ids[ids.length - 1]]);
  if (lastMsg.sender.toLowerCase() !== aliceAccount.address.toLowerCase()) {
    console.error("FAIL: Last message sender mismatch");
    process.exit(1);
  }
  // Verify contract is working by checking nextMessageId
  console.log("   Verifying contract state...");
  try {
    const nextId = await mail.read.nextMessageId();
    console.log(`   Contract nextMessageId: ${nextId}`);
  } catch (e) {
    console.log(`   Error reading contract: ${e.message}`);
  }

  console.log("\nPASS: send-receive test completed successfully");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
