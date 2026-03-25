/**
 * AA config builder. Centralizes construction of AaConfig from EnvConfig.
 */

import type { AaConfig } from "./aa";
import type { EnvConfig } from "./config";

const DEFAULT_ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const DEFAULT_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

/** Build AaConfig from env. Pass referralContext when available (e.g. from getReferralContext()). */
export function buildAaConfig(
  env: EnvConfig,
  referralContext?: { referralAddress: string; referralBps: number } | null
): AaConfig {
  return {
    bundlerUrl: env.VITE_BUNDLER_URL,
    paymasterApiUrl: env.VITE_PAYMASTER_API_URL,
    rpcUrl: env.VITE_RPC_URL,
    entryPointAddress: env.VITE_ENTRYPOINT_ADDRESS ?? DEFAULT_ENTRYPOINT,
    chainId: parseInt(env.VITE_CHAIN_ID, 10),
    usdcAddress: env.VITE_USDC_ADDRESS ?? DEFAULT_USDC,
    ...(referralContext && { referralContext }),
  };
}
