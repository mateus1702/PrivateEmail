import { config } from "dotenv";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

config({ path: resolve(process.cwd(), "..", "..", ".env") });

const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";
const RPC_RETRY_MS = 2000;
const RPC_RETRY_ATTEMPTS = 30;

async function waitForRpc(rpcUrl: string): Promise<void> {
  const provider = new JsonRpcProvider(rpcUrl);
  for (let i = 0; i < RPC_RETRY_ATTEMPTS; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      if (i === RPC_RETRY_ATTEMPTS - 1) throw new Error(`RPC not ready after ${RPC_RETRY_ATTEMPTS} attempts`);
      await new Promise((r) => setTimeout(r, RPC_RETRY_MS));
    }
  }
}

async function main() {
  const rpcUrl = process.env.RPC_URL?.trim();
  if (!rpcUrl) throw new Error("RPC_URL required (set in .env)");

  console.log("[deployer] Waiting for RPC...");
  await waitForRpc(rpcUrl);

  const outputDir = process.env.DEPLOY_OUTPUT_DIR ?? "/deploy-output";
  const addressFile = process.env.MAIL_CONTRACT_ADDRESS_FILE ?? join(outputDir, "mail-address");
  const artifactsBase = process.env.CONTRACTS_ARTIFACTS_PATH ?? "/app/contracts-artifacts";
  const artifactPath = join(artifactsBase, "contracts", "PrivateMail.sol", "PrivateMail.json");

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const provider = new JsonRpcProvider(rpcUrl);

  const deployer = process.env.DEPLOYER_PRIVATE_KEY
    ? new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)
    : Wallet.fromPhrase(
        process.env.DEPLOYER_MNEMONIC ?? DEFAULT_MNEMONIC,
        provider
      );

  const chainId = (await provider.getNetwork()).chainId;
  console.log(`[deployer] network chainId=${chainId} deployer=${deployer.address}`);

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const mail = await factory.deploy();
  await mail.waitForDeployment();
  const address = await mail.getAddress();

  console.log(`[deployer] PrivateMail address=${address}`);

  mkdirSync(dirname(addressFile), { recursive: true });
  writeFileSync(addressFile, address, "utf8");

  const contractsJson = {
    chainId: Number(chainId),
    PrivateMail: { address, abi: artifact.abi },
  };
  const contractsPath = join(outputDir, "contracts.json");
  writeFileSync(contractsPath, JSON.stringify(contractsJson, null, 2), "utf8");
  console.log(`[deployer] wrote ${addressFile} and ${contractsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
