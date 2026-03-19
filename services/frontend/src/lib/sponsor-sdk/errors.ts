/**
 * Sponsor SDK error model. Enables predictable branching in dApps.
 */

export const SPONSOR_SDK_ERROR_CODES = {
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  RPC_ERROR: "RPC_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  INVALID_REFERRAL_CONTEXT: "INVALID_REFERRAL_CONTEXT",
  ENTRYPOINT_MISMATCH: "ENTRYPOINT_MISMATCH",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
} as const;

export type SponsorSdkErrorCode = (typeof SPONSOR_SDK_ERROR_CODES)[keyof typeof SPONSOR_SDK_ERROR_CODES];

export class SponsorSdkError extends Error {
  readonly code: SponsorSdkErrorCode;
  readonly cause?: unknown;
  constructor(message: string, code: SponsorSdkErrorCode, cause?: unknown) {
    super(message);
    this.name = "SponsorSdkError";
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, SponsorSdkError.prototype);
  }
}
