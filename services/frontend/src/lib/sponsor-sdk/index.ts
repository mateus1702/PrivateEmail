/**
 * Sponsor SDK - Reusable paymaster sponsor client for dApps.
 * Calls pm_sponsorUserOperation, returns sponsorship + quote, provides TTL helpers.
 */

export { createSponsorClient, applySponsorshipToUserOp, isQuoteExpired } from "./client";
export type { SponsorClient } from "./client";
export type { SponsorClientConfig } from "./types";
export { SponsorSdkError, SPONSOR_SDK_ERROR_CODES } from "./errors";
export type { SponsorSdkErrorCode } from "./errors";
export { validateReferralContext, validateSponsorResponse } from "./validate";
export type {
  PaymasterSponsorship,
  ReferralContext,
  SponsorQuote,
  SponsorRequest,
  SponsorResult,
} from "./types";
