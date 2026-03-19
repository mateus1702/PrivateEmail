/**
 * Sponsor SDK client. Calls pm_sponsorUserOperation and provides TTL helpers.
 */

import { SponsorSdkError, SPONSOR_SDK_ERROR_CODES } from "./errors";
import type {
  PaymasterSponsorship,
  ReferralContext,
  SponsorClientConfig,
  SponsorQuote,
  SponsorRequest,
  SponsorResult,
} from "./types";
import { validateReferralContext, validateSponsorResponse } from "./validate";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_QUOTE_EXPIRY_BUFFER_SEC = 30;

function stringifyRpcPayload(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? `0x${v.toString(16)}` : v
  );
}

export interface SponsorClient {
  sponsor(request: SponsorRequest): Promise<SponsorResult>;
  isQuoteExpired(quote: SponsorQuote, bufferSec?: number): boolean;
  refreshIfExpired(request: {
    userOp: Record<string, unknown>;
    currentResult: SponsorResult;
    referralContext?: ReferralContext;
  }): Promise<SponsorResult>;
}

export function createSponsorClient(config: SponsorClientConfig): SponsorClient {
  const {
    paymasterUrl,
    entryPointAddress,
    referralContext: defaultReferralContext,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    quoteExpiryBufferSec = DEFAULT_QUOTE_EXPIRY_BUFFER_SEC,
  } = config;

  const url = paymasterUrl.replace(/\/$/, "");

  return {
    async sponsor(request: SponsorRequest): Promise<SponsorResult> {
      const { userOp, referralContext: requestRefCtx } = request;
      const referralContext = requestRefCtx ?? defaultReferralContext;
      if (referralContext) validateReferralContext(referralContext);

      const params: unknown[] = [userOp, entryPointAddress];
      if (referralContext) params.push(referralContext);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: stringifyRpcPayload({
            jsonrpc: "2.0",
            id: 1,
            method: "pm_sponsorUserOperation",
            params,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && err.name === "AbortError";
        throw new SponsorSdkError(
          isAbort ? "Paymaster request timed out" : "Failed to reach paymaster API",
          isAbort ? SPONSOR_SDK_ERROR_CODES.TIMEOUT : SPONSOR_SDK_ERROR_CODES.NETWORK_ERROR,
          err
        );
      }
      clearTimeout(timeoutId);

      const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (json.error) {
        throw new SponsorSdkError(
          `Paymaster error: ${json.error.message ?? JSON.stringify(json.error)}`,
          SPONSOR_SDK_ERROR_CODES.RPC_ERROR
        );
      }

      const result = json.result;
      validateSponsorResponse(result);
      return result as SponsorResult;
    },

    isQuoteExpired(quote: SponsorQuote, bufferSec = quoteExpiryBufferSec): boolean {
      return isQuoteExpired(quote, bufferSec);
    },

    async refreshIfExpired(request: {
      userOp: Record<string, unknown>;
      currentResult: SponsorResult;
      referralContext?: ReferralContext;
    }): Promise<SponsorResult> {
      const { userOp, currentResult, referralContext } = request;
      if (!this.isQuoteExpired(currentResult)) return currentResult;
      return this.sponsor({ userOp, referralContext: referralContext ?? defaultReferralContext });
    },
  };
}

/**
 * Standalone check: is quote expired or within buffer of expiry?
 * Use when you don't have a client instance (e.g. in UI components).
 */
export function isQuoteExpired(quote: SponsorQuote, bufferSec = DEFAULT_QUOTE_EXPIRY_BUFFER_SEC): boolean {
  const validUntil = BigInt(quote.validUntil);
  const now = BigInt(Math.floor(Date.now() / 1000));
  return validUntil <= now + BigInt(bufferSec);
}

/**
 * Merge sponsorship fields into a UserOp. Use before eth_sendUserOperation.
 */
export function applySponsorshipToUserOp(
  userOp: Record<string, unknown>,
  sponsorship: PaymasterSponsorship
): Record<string, unknown> {
  return {
    ...userOp,
    paymaster: sponsorship.paymaster,
    paymasterData: sponsorship.paymasterData,
    paymasterVerificationGasLimit: sponsorship.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: sponsorship.paymasterPostOpGasLimit,
  };
}
