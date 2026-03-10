#!/usr/bin/env node

/**
 * Rotates CONTRACT_DEPLOYER_PRIVATE_KEY in .env.prod and validates the generated
 * address is a plain EOA on the target RPC (eth_getCode == 0x).
 *
 * Usage:
 *   node tools/key-rotator/rotate-env-prod-keys.js --env .env.prod
 *   node tools/key-rotator/rotate-env-prod-keys.js --env ../../.env.prod --rpc https://rpc.ankr.com/polygon
 */

const fs = require("fs");
const path = require("path");
const { Wallet, JsonRpcProvider } = require("ethers");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--env") args.env = argv[++i];
    else if (token === "--rpc") args.rpc = argv[++i];
    else if (token === "--max-attempts") args.maxAttempts = Number(argv[++i]);
    else if (token === "--help" || token === "-h") args.help = true;
  }
  return args;
}

function showHelp() {
  console.log(`
Rotate CONTRACT_DEPLOYER_PRIVATE_KEY in .env.prod and validate EOA.

Usage:
  node tools/key-rotator/rotate-env-prod-keys.js [options]

Options:
  --env <path>           Path to env file (default: .env.prod in project root)
  --rpc <url>            RPC URL for EOA validation (default: TOOLS_RPC_URL from env file)
  --max-attempts <n>     Max generation attempts (default: 25)
  --help, -h             Show this help
`);
}

async function isPlainEoa(rpcUrl, address) {
  const provider = new JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(address);
  const normalized = String(code || "").toLowerCase();
  return normalized === "0x" || normalized === "0x0";
}

async function generateValidWallet(rpcUrl, maxAttempts) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const wallet = Wallet.createRandom();
    const eoa = await isPlainEoa(rpcUrl, wallet.address);
    if (eoa) return wallet;
  }
  throw new Error(`Could not generate plain EOA within ${maxAttempts} attempts`);
}

function updateEnvLines(lines, replacements) {
  const output = [];
  const seen = new Set();

  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) {
      output.push(line);
      continue;
    }

    const key = m[1];
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      output.push(`${key}=${replacements[key]}`);
      seen.add(key);
    } else {
      output.push(line);
    }
  }

  const missing = Object.keys(replacements).filter((k) => !seen.has(k));
  if (missing.length) {
    output.push("");
    output.push("# --- Added by key-rotator ---");
    for (const key of missing) {
      output.push(`${key}=${replacements[key]}`);
    }
  }

  return output;
}

function parseKeyValueLines(lines) {
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const defaultEnvPath = path.resolve(process.cwd(), ".env.prod");
  const envPath = path.resolve(process.cwd(), args.env || defaultEnvPath);
  const maxAttempts = Number.isFinite(args.maxAttempts) && args.maxAttempts > 0 ? args.maxAttempts : 25;

  if (!fs.existsSync(envPath)) {
    throw new Error(`Env file not found: ${envPath}`);
  }

  const original = fs.readFileSync(envPath, "utf8");
  const lines = original.split(/\r?\n/);
  const env = parseKeyValueLines(lines);

  const rpcUrl = (args.rpc || env.TOOLS_RPC_URL || "").trim();
  if (!rpcUrl) {
    throw new Error("RPC URL not provided. Use --rpc or set TOOLS_RPC_URL in env file.");
  }

  console.log(`Using RPC: ${rpcUrl}`);

  const provider = new JsonRpcProvider(rpcUrl);
  try {
    await provider.getBlockNumber();
  } catch (e) {
    throw new Error(`RPC unreachable or invalid: ${e.message}`);
  }

  console.log("Generating and validating fresh EOA for deployer...");

  const deployer = await generateValidWallet(rpcUrl, maxAttempts);

  const replacements = {
    CONTRACT_DEPLOYER_PRIVATE_KEY: deployer.privateKey,
  };

  const updatedLines = updateEnvLines(lines, replacements);
  const updatedText = `${updatedLines.join("\n")}\n`;

  const backupPath = `${envPath}.bak.${Date.now()}`;
  fs.writeFileSync(backupPath, original, "utf8");
  fs.writeFileSync(envPath, updatedText, "utf8");

  console.log(`Backup created: ${backupPath}`);
  console.log(`Updated: ${envPath}`);
  console.log("Rotation complete. New deployer address:", deployer.address);
}

main().catch((err) => {
  console.error(`Key rotation failed: ${err.message}`);
  process.exit(1);
});
