import { describe, it, expect } from "vitest";
import {
  finalApproveFromQuote,
  MIN_COMPOSE_USDC_E6,
  MIN_REGISTER_USDC_E6,
  PROBE_APPROVE_REGISTER_E6,
  PROBE_APPROVE_SEND_E6,
} from "./usdcThresholds";

describe("usdcThresholds", () => {
  it("exposes expected gate and probe sizes (6 decimals)", () => {
    expect(MIN_REGISTER_USDC_E6).toBe(300_000n);
    expect(MIN_COMPOSE_USDC_E6).toBe(100_000n);
    expect(PROBE_APPROVE_REGISTER_E6).toBe(300_000n);
    expect(PROBE_APPROVE_SEND_E6).toBe(100_000n);
  });

  it("finalApproveFromQuote adds buffer over maxTotalCostUsdcE6", () => {
    expect(finalApproveFromQuote("100000")).toBe(100000n + 2000n + 5000n);
  });

  it("finalApproveFromQuote rejects non-positive max", () => {
    expect(() => finalApproveFromQuote("0")).toThrow(/Invalid sponsor quote/);
  });
});
