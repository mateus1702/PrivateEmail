/**
 * Sponsor SDK types. Framework-agnostic, reusable by dApps.
 */

/** Optional referral context for pm_sponsorUserOperation (0-500 bps). */
export interface ReferralContext {
  referralAddress: string;
  referralBps: number;
}

/** Paymaster sponsorship fields for eth_sendUserOperation. */
export interface PaymasterSponsorship {
  paymaster: string;
  paymasterData: string;
  paymasterVerificationGasLimit: string;
  paymasterPostOpGasLimit: string;
}

/** Quote breakdown for cost confirmation modal. */
export interface SponsorQuote {
  estimatedBaseCostUsdcE6: string;
  estimatedReferralUsdcE6: string;
  estimatedTotalCostUsdcE6: string;
  maxBaseCostUsdcE6: string;
  maxReferralUsdcE6: string;
  maxTotalCostUsdcE6: string;
  estimatedGas: string;
  /** Unix epoch seconds - quote valid until this time (for TTL check). */
  validUntil: string;
}

/** Combined sponsorship + quote (returned by sponsor call). */
export interface SponsorResult extends PaymasterSponsorship, SponsorQuote {}

/** Client configuration. */
export interface SponsorClientConfig {
  paymasterUrl: string;
  entryPointAddress: string;
  referralContext?: ReferralContext;
  /** Optional custom fetch (for SSR/testing). */
  fetchFn?: typeof fetch;
  /** Request timeout in ms (default 10000). */
  timeoutMs?: number;
  /** Seconds before validUntil when quote is considered stale (default 30). */
  quoteExpiryBufferSec?: number;
}

/** Request for sponsor call. */
export interface SponsorRequest {
  userOp: Record<string, unknown>;
  referralContext?: ReferralContext;
}
