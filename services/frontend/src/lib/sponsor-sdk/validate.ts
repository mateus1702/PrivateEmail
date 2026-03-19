/**
 * Validation helpers for referral context and API response shape.
 */

import { SponsorSdkError, SPONSOR_SDK_ERROR_CODES } from "./errors";
import type { ReferralContext, SponsorResult } from "./types";

const REFERRAL_BPS_MAX = 500;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Validate referral context. Throws SponsorSdkError if invalid. */
export function validateReferralContext(ctx: ReferralContext): void {
  const { referralAddress, referralBps } = ctx;
  const bps = Math.floor(Number(referralBps));
  if (Number.isNaN(bps) || bps < 0 || bps > REFERRAL_BPS_MAX) {
    throw new SponsorSdkError(
      `referralBps must be 0-${REFERRAL_BPS_MAX}, got ${referralBps}`,
      SPONSOR_SDK_ERROR_CODES.INVALID_REFERRAL_CONTEXT
    );
  }
  const addr = String(referralAddress).trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    throw new SponsorSdkError(
      "referralAddress must be a valid 20-byte hex address",
      SPONSOR_SDK_ERROR_CODES.INVALID_REFERRAL_CONTEXT
    );
  }
  if (bps > 0 && addr === ZERO_ADDRESS) {
    throw new SponsorSdkError(
      "referralAddress required when referralBps > 0",
      SPONSOR_SDK_ERROR_CODES.INVALID_REFERRAL_CONTEXT
    );
  }
}

const REQUIRED_SPONSOR_FIELDS = [
  "paymaster",
  "paymasterData",
  "paymasterVerificationGasLimit",
  "paymasterPostOpGasLimit",
] as const;

const REQUIRED_QUOTE_FIELDS = [
  "estimatedBaseCostUsdcE6",
  "estimatedReferralUsdcE6",
  "estimatedTotalCostUsdcE6",
  "maxBaseCostUsdcE6",
  "maxReferralUsdcE6",
  "maxTotalCostUsdcE6",
  "estimatedGas",
  "validUntil",
] as const;

/** Validate raw API response and assert SponsorResult shape. */
export function validateSponsorResponse(result: unknown): asserts result is SponsorResult & Record<string, unknown> {
  if (result == null || typeof result !== "object") {
    throw new SponsorSdkError(
      "Sponsor response is not an object",
      SPONSOR_SDK_ERROR_CODES.INVALID_RESPONSE
    );
  }
  const r = result as Record<string, unknown>;
  for (const f of REQUIRED_SPONSOR_FIELDS) {
    if (r[f] == null || typeof r[f] !== "string") {
      throw new SponsorSdkError(
        `Missing or invalid sponsor field: ${f}`,
        SPONSOR_SDK_ERROR_CODES.INVALID_RESPONSE
      );
    }
  }
  for (const f of REQUIRED_QUOTE_FIELDS) {
    if (r[f] == null || typeof r[f] !== "string") {
      throw new SponsorSdkError(
        `Missing or invalid quote field: ${f}`,
        SPONSOR_SDK_ERROR_CODES.INVALID_RESPONSE
      );
    }
  }
  const validUntilStr = String(r.validUntil);
  const validUntil = BigInt(validUntilStr);
  if (validUntil < 0n) {
    throw new SponsorSdkError(
      "validUntil must be non-negative epoch seconds",
      SPONSOR_SDK_ERROR_CODES.INVALID_RESPONSE
    );
  }
}
