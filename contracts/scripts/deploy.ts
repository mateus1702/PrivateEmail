import { config } from "dotenv";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { network } from "hardhat";

config({ path: resolve(process.cwd(), "..", ".env") });

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  const chainId = networkInfo.chainId;

  console.log(`[deploy] network=localhost chainId=${chainId} deployer=${deployer.address}`);

  const PrivateMail = await ethers.getContractFactory("PrivateMail");
  const mail = await PrivateMail.deploy();
  await mail.waitForDeployment();
  const address = await mail.getAddress();

  console.log(`[deploy] PrivateMail address=${address}`);

  const outputDir = process.env.DEPLOY_OUTPUT_DIR ?? resolve(process.cwd(), "..", "deploy-output");
  const addressFile = process.env.MAIL_CONTRACT_ADDRESS_FILE ?? resolve(outputDir, "mail-address");
  const artifactsBase = process.env.CONTRACTS_ARTIFACTS_PATH ?? resolve(process.cwd(), "artifacts");
  const artifactsPath = resolve(artifactsBase, "contracts", "PrivateMail.sol", "PrivateMail.json");
  const artifact = JSON.parse(readFileSync(artifactsPath, "utf8"));

  mkdirSync(dirname(addressFile), { recursive: true });
  writeFileSync(addressFile, address, "utf8");

  const contractsJson = {
    chainId: Number(chainId),
    PrivateMail: { address, abi: artifact.abi },
  };
  const contractsPath = join(outputDir, "contracts.json");
  writeFileSync(contractsPath, JSON.stringify(contractsJson, null, 2), "utf8");
  console.log(`[deploy] wrote ${addressFile} and ${contractsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
