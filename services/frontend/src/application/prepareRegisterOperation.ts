/**
 * Application use-case: prepare register + activate UserOp with sponsor quote.
 */

import type { ContractsConfig } from "../lib/config";
import type { AaConfig, SponsorQuote } from "../lib/aa";
import { getQuoteAndPreparedOpForRegister } from "../lib/aa";
import type { Address } from "viem";

export interface PrepareRegisterInput {
  config: ContractsConfig;
  aaConfig: AaConfig;
  pubKeyHex: `0x${string}`;
  ownerPrivateKeyHex: `0x${string}`;
  username: string;
}

export interface PrepareRegisterResult {
  preparedUserOp: Record<string, unknown>;
  quote: SponsorQuote;
}

export async function prepareRegisterOperation(
  input: PrepareRegisterInput
): Promise<PrepareRegisterResult> {
  const { preparedUserOp, quote } = await getQuoteAndPreparedOpForRegister(input.aaConfig, {
    mailAddress: input.config.PrivateMail.address as Address,
    pubKeyHex: input.pubKeyHex,
    ownerPrivateKeyHex: input.ownerPrivateKeyHex,
    username: input.username,
  });
  return { preparedUserOp: preparedUserOp as Record<string, unknown>, quote };
}
