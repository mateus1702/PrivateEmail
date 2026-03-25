#!/usr/bin/env node
/**
 * Creates .env.prod from .env.example if it doesn't exist, generates a new
 * CONTRACT_DEPLOYER_PRIVATE_KEY, and adds the deployer address as a comment for funding.
 *
 * Usage: node tools/init-env-prod/init-env-prod.js
 *        npm run init-env-prod (from project root)
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const envProdPath = join(projectRoot, ".env.prod");
const envExamplePath = join(projectRoot, ".env.example");

async function main() {
  if (!existsSync(envProdPath)) {
    if (!existsSync(envExamplePath)) {
      throw new Error(".env.example not found");
    }
    copyFileSync(envExamplePath, envProdPath);
    console.log(`Created .env.prod from .env.example`);
  }

  const { Wallet } = await import("ethers");
  const wallet = Wallet.createRandom();

  let content = readFileSync(envProdPath, "utf8");

  const deployerComment = `# CONTRACT_DEPLOYER_ADDRESS=${wallet.address} (send MATIC/funds to this address for deployment)`;
  const deployerKeyLine = `CONTRACT_DEPLOYER_PRIVATE_KEY=${wallet.privateKey}`;

  const lines = content.split(/\r?\n/);
  const out = [];
  let replaced = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^# CONTRACT_DEPLOYER_ADDRESS=/.test(line)) continue;
    if (/^CONTRACT_DEPLOYER_PRIVATE_KEY=/.test(line)) {
      out.push(deployerComment);
      out.push(deployerKeyLine);
      replaced = true;
      continue;
    }
    out.push(line);
  }

  if (!replaced) {
    out.push("");
    out.push(deployerComment);
    out.push(deployerKeyLine);
  }

  content = out.join("\n") + (content.endsWith("\n") ? "" : "\n");

  writeFileSync(envProdPath, content, "utf8");
  console.log(`Updated .env.prod with new CONTRACT_DEPLOYER_PRIVATE_KEY`);
  console.log(`Deployer address: ${wallet.address} (send funds to this address)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
