import { config } from "dotenv";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { network } from "hardhat";

// deploy.ts lives at project5/contracts/scripts/; root package.json is at project5/
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
config({ path: join(projectRoot, ".env") });

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  const chainId = networkInfo.chainId;

  const rawOutputDir = (process.env.CONTRACT_DEPLOY_OUTPUT_DIR ?? "").trim();
  const outputDir =
    !rawOutputDir || rawOutputDir === "/deploy-output" || rawOutputDir === "\\deploy-output"
      ? join(projectRoot, "deploy-output")
      : rawOutputDir;

  const rawAddressFile = (process.env.CONTRACT_MAIL_ADDRESS_FILE ?? "").trim();
  const addressFile =
    !rawAddressFile ||
    rawAddressFile === "/deploy-output/mail-address" ||
    rawAddressFile === "\\deploy-output\\mail-address" ||
    rawAddressFile === "/deploy-output/mail-address.txt" ||
    rawAddressFile === "\\deploy-output\\mail-address.txt"
      ? join(outputDir, "mail-address.txt")
      : rawAddressFile;
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(addressFile), { recursive: true });

  console.log(`[deploy] network chainId=${chainId} deployer=${deployer.address}`);
  if (existsSync(addressFile)) {
    const existingAddress = readFileSync(addressFile, "utf8").trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(existingAddress)) {
      const code = await ethers.provider.getCode(existingAddress);
      if (code && code !== "0x" && code.length > 2) {
        console.log(`[deploy] Contract already deployed at ${existingAddress}, skipping`);
        return;
      }
    }
  }

  const PrivateMail = await ethers.getContractFactory("PrivateMail");
  const mail = await PrivateMail.deploy();
  await mail.waitForDeployment();
  const address = await mail.getAddress();

  console.log(`[deploy] PrivateMail deployed at ${address}`);

  writeFileSync(addressFile, address.trim(), "utf8");
  console.log(`[deploy] wrote ${addressFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
