/**
 * Config loader. Reads only from VITE_* env vars (no defaults, no fetch).
 * VITE_* values are the sole source of truth. Fails fast if any required var is missing.
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
  VITE_ENTRYPOINT_ADDRESS: string;
  VITE_USDC_ADDRESS: string;
  VITE_ANVIL_WHALE_CANDIDATES: string;
  VITE_ENABLE_ANVIL_WHALE_FUNDING: string;
  VITE_REFERRAL_BPS: string;
  VITE_REFERRAL_ADDRESS: string;
}

export interface ReferralContext {
  referralAddress: string;
  referralBps: number;
}

// Used for type (typeof REQUIRED_VARS)[number] in requireEnv
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type-only use
const REQUIRED_VARS = [
  "VITE_PRIVATE_MAIL_ADDRESS",
  "VITE_RPC_URL",
  "VITE_BUNDLER_URL",
  "VITE_PAYMASTER_API_URL",
  "VITE_CHAIN_ID",
  "VITE_ENTRYPOINT_ADDRESS",
  "VITE_USDC_ADDRESS",
  "VITE_ANVIL_WHALE_CANDIDATES",
  "VITE_ENABLE_ANVIL_WHALE_FUNDING",
] as const;

/** Optional referral config. When both set, sponsor calls include referral context. */
export function getReferralContext(): { referralAddress: string; referralBps: number } | undefined {
  const bpsRaw = import.meta.env.VITE_REFERRAL_BPS;
  const addrRaw = import.meta.env.VITE_REFERRAL_ADDRESS;
  const bps = bpsRaw != null && bpsRaw !== "" ? parseInt(String(bpsRaw), 10) : 0;
  const addr = typeof addrRaw === "string" ? addrRaw.trim() : "";
  if (bps > 0 && /^0x[a-fA-F0-9]{40}$/.test(addr) && addr !== "0x0000000000000000000000000000000000000000") {
    return { referralAddress: addr.toLowerCase(), referralBps: Math.min(500, Math.max(0, bps)) };
  }
  return undefined;
}

/** Optional. When both set, referral context is used for sponsor calls. */
export const REFERRAL_ENV = {
  BPS: "VITE_REFERRAL_BPS",
  ADDRESS: "VITE_REFERRAL_ADDRESS",
} as const;

function requireEnv(name: (typeof REQUIRED_VARS)[number]): string {
  const v = import.meta.env[name];
  const trimmed = v === undefined || v === null ? "" : String(v).trim();
  if (trimmed === "") {
    if (name === "VITE_ANVIL_WHALE_CANDIDATES") {
      return "";
    }
    throw new Error(`Missing required env: ${name}. Set it in .env or build args.`);
  }
  return trimmed;
}

function validateAddress(addr: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error(
      `Invalid VITE_PRIVATE_MAIL_ADDRESS: must be a 0x-prefixed 40-digit hex address. Got: ${addr}`
    );
  }
  if (addr.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    throw new Error("Invalid VITE_PRIVATE_MAIL_ADDRESS: zero address. Deploy the contract first.");
  }
}

function validateChainId(s: string): number {
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n < 1 || n > 0xffffffff) {
    throw new Error(`Invalid VITE_CHAIN_ID: must be a positive integer. Got: ${s}`);
  }
  return n;
}

let cachedConfig: ContractsConfig | null = null;
let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const addr = requireEnv("VITE_PRIVATE_MAIL_ADDRESS");
  validateAddress(addr);

  const chainIdStr = requireEnv("VITE_CHAIN_ID");
  validateChainId(chainIdStr);

  const refBps = (import.meta.env.VITE_REFERRAL_BPS ?? "0").toString().trim();
  const refAddr = (import.meta.env.VITE_REFERRAL_ADDRESS ?? "0x0000000000000000000000000000000000000000").toString().trim().toLowerCase();

  const raw: EnvConfig = {
    VITE_RPC_URL: requireEnv("VITE_RPC_URL"),
    VITE_BUNDLER_URL: requireEnv("VITE_BUNDLER_URL"),
    VITE_PAYMASTER_API_URL: requireEnv("VITE_PAYMASTER_API_URL"),
    VITE_CHAIN_ID: chainIdStr,
    VITE_ENTRYPOINT_ADDRESS: requireEnv("VITE_ENTRYPOINT_ADDRESS"),
    VITE_USDC_ADDRESS: requireEnv("VITE_USDC_ADDRESS"),
    VITE_ANVIL_WHALE_CANDIDATES: requireEnv("VITE_ANVIL_WHALE_CANDIDATES"),
    VITE_ENABLE_ANVIL_WHALE_FUNDING: requireEnv("VITE_ENABLE_ANVIL_WHALE_FUNDING"),
    VITE_REFERRAL_BPS: refBps,
    VITE_REFERRAL_ADDRESS: refAddr,
  };

  cachedEnv = raw;
  return cachedEnv;
}

export function getConfig(): ContractsConfig {
  if (cachedConfig) return cachedConfig;

  const addr = requireEnv("VITE_PRIVATE_MAIL_ADDRESS");
  validateAddress(addr);

  const chainIdStr = requireEnv("VITE_CHAIN_ID");
  const chainId = validateChainId(chainIdStr);

  cachedConfig = {
    chainId,
    PrivateMail: {
      address: addr,
      abi: [],
    },
  };
  return cachedConfig;
}
