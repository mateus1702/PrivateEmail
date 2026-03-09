/**
 * Runtime config loader. Fetches contracts.json and env.json at app startup.
 * In Docker: served from /config/* (mounted deploy-output + env).
 * For local dev: set VITE_CONFIG_URL or place contracts.json in public/config/
 */

export interface ContractsConfig {
  chainId: number;
  PrivateMail: {
    address: string;
    abi: readonly unknown[];
  };
}

export interface EnvConfig {
  VITE_RPC_URL: string;
  VITE_BUNDLER_URL: string;
  VITE_PAYMASTER_API_URL: string;
  VITE_CHAIN_ID: string;
  VITE_ENTRYPOINT_ADDRESS?: string;
  VITE_USDC_ADDRESS?: string;
  VITE_ANVIL_WHALE_CANDIDATES?: string;
  VITE_ENABLE_ANVIL_WHALE_FUNDING?: string;
}

let cachedConfig: ContractsConfig | null = null;
let cachedEnv: EnvConfig | null = null;

export async function loadEnv(): Promise<EnvConfig> {
  if (cachedEnv) return cachedEnv;
  const url = `${window.location.origin}/config/env.json`;
  const res = await fetch(url);
  if (!res.ok) {
    const fallback: EnvConfig = {
      VITE_RPC_URL: import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8545",
      VITE_BUNDLER_URL: import.meta.env.VITE_BUNDLER_URL ?? "",
      VITE_PAYMASTER_API_URL: import.meta.env.VITE_PAYMASTER_API_URL ?? "",
      VITE_CHAIN_ID: import.meta.env.VITE_CHAIN_ID ?? "137",
      VITE_ENTRYPOINT_ADDRESS: import.meta.env.VITE_ENTRYPOINT_ADDRESS ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      VITE_USDC_ADDRESS: import.meta.env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      VITE_ANVIL_WHALE_CANDIDATES: import.meta.env.VITE_ANVIL_WHALE_CANDIDATES ?? "0x47c031236e19d024b42f8de678d3110562d925b5,0x794a61358D6845594F94dc1DB02A252b5b4814aD,0xF977814e90dA44bFA03b6295A0616a897441aceC,0x28C6c06298d514Db089934071355E5743bf21d60",
      VITE_ENABLE_ANVIL_WHALE_FUNDING: import.meta.env.VITE_ENABLE_ANVIL_WHALE_FUNDING ?? "true",
    };
    cachedEnv = applyLocalDevProxy(fallback);
    return cachedEnv;
  }
  const raw = (await res.json()) as EnvConfig;
  cachedEnv = applyLocalDevProxy(raw);
  return cachedEnv;
}

function applyLocalDevProxy(env: EnvConfig): EnvConfig {
  if (typeof window === "undefined") return env;
  const origin = window.location.origin;
  const paymaster = env.VITE_PAYMASTER_API_URL ?? "";
  const bundler = env.VITE_BUNDLER_URL ?? "";
  let out = env;
  if (/^https?:\/\/(127\.0\.0\.1|localhost):3000(\/|$)/.test(paymaster)) {
    out = { ...out, VITE_PAYMASTER_API_URL: `${origin}/dev-paymaster-api` };
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost):4337(\/|$)/.test(bundler)) {
    out = { ...out, VITE_BUNDLER_URL: `${origin}/dev-bundler` };
  }
  return out;
}

export async function loadConfig(): Promise<ContractsConfig> {
  if (cachedConfig) return cachedConfig;

  const configUrl =
    import.meta.env.VITE_CONFIG_URL ?? `${window.location.origin}/config/contracts.json`;

  const res = await fetch(configUrl);
  if (!res.ok) {
    throw new Error(`Failed to load config from ${configUrl}: ${res.status}`);
  }

  const json = await res.json();
  if (json?.error) {
    throw new Error(`Config error: ${json.error}`);
  }
  if (!json?.PrivateMail?.address) {
    throw new Error("Invalid config: missing PrivateMail address");
  }
  const addr = String(json.PrivateMail.address).trim().toLowerCase();
  if (addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Invalid config: contract address is zero. Run contract-deployer first and copy deploy-output/contracts.json to public/config/ (local dev) or ensure deploy-output volume is mounted (Docker)."
    );
  }

  cachedConfig = json as ContractsConfig;
  return cachedConfig;
}

export function getConfig(): ContractsConfig | null {
  return cachedConfig;
}
