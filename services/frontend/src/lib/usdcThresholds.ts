/**
 * Smart-account USDC gates and ERC-20 approve sizing for sponsored UserOps.
 * Balances are checked on-chain in 6-decimal USDC base units (e6).
 */

import { parseUnits } from "viem";

/** Minimum smart-account USDC balance to start activation (0.3 USDC). */
export const MIN_REGISTER_USDC_E6 = parseUnits("0.3", 6);

/** Minimum smart-account USDC balance to open compose (0.1 USDC). */
export const MIN_COMPOSE_USDC_E6 = parseUnits("0.1", 6);

/** Provisional approve amount in register estimate UserOp (0.3 USDC). */
export const PROBE_APPROVE_REGISTER_E6 = parseUnits("0.3", 6);

/** On-chain approve-only probe when opening compose (0.1 USDC). */
export const PROBE_APPROVE_SEND_E6 = parseUnits("0.1", 6);

/**
 * Target USDC allowance for paymaster from pm_sponsorUserOperation maxTotalCostUsdcE6.
 * Adds ~2% + fixed micro-USDC slack for paymaster rounding.
 */
export function finalApproveFromQuote(maxTotalCostUsdcE6: string): bigint {
  const base = BigInt(maxTotalCostUsdcE6);
  if (base <= 0n) {
    throw new Error("Invalid sponsor quote: maxTotalCostUsdcE6");
  }
  return base + (base * 2n) / 100n + 5000n;
}
