/**
 * Unit tests for AA config builder.
 */

import { describe, it, expect } from "vitest";
import { buildAaConfig } from "./aaConfig";
import type { EnvConfig } from "./config";

const minimalEnv: EnvConfig = {
  VITE_RPC_URL: "https://rpc.example.com",
  VITE_BUNDLER_URL: "https://bundler.example.com",
  VITE_PAYMASTER_API_URL: "https://pm.example.com",
  VITE_CHAIN_ID: "137",
  VITE_ENTRYPOINT_ADDRESS: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  VITE_USDC_ADDRESS: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  VITE_ANVIL_WHALE_CANDIDATES: "",
  VITE_ENABLE_ANVIL_WHALE_FUNDING: "false",
  VITE_REFERRAL_BPS: "0",
  VITE_REFERRAL_ADDRESS: "0x0000000000000000000000000000000000000000",
};

describe("buildAaConfig", () => {
  it("builds config from env with required fields", () => {
    const config = buildAaConfig(minimalEnv);
    expect(config.bundlerUrl).toBe("https://bundler.example.com");
    expect(config.paymasterApiUrl).toBe("https://pm.example.com");
    expect(config.rpcUrl).toBe("https://rpc.example.com");
    expect(config.chainId).toBe(137);
    expect(config.entryPointAddress).toBe("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
    expect(config.usdcAddress).toBe("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
  });

  it("uses default entrypoint when env value is undefined", () => {
    const env = { ...minimalEnv, VITE_ENTRYPOINT_ADDRESS: undefined as unknown as string };
    const config = buildAaConfig(env);
    expect(config.entryPointAddress).toBe("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
  });

  it("uses default USDC when env value is undefined", () => {
    const env = { ...minimalEnv, VITE_USDC_ADDRESS: undefined as unknown as string };
    const config = buildAaConfig(env);
    expect(config.usdcAddress).toBe("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
  });

  it("includes referralContext when provided", () => {
    const ref = { referralAddress: "0x1234567890123456789012345678901234567890", referralBps: 100 };
    const config = buildAaConfig(minimalEnv, ref);
    expect(config.referralContext).toEqual(ref);
  });

  it("omits referralContext when not provided", () => {
    const config = buildAaConfig(minimalEnv);
    expect(config.referralContext).toBeUndefined();
  });

  it("omits referralContext when null is passed", () => {
    const config = buildAaConfig(minimalEnv, null);
    expect(config.referralContext).toBeUndefined();
  });
});
