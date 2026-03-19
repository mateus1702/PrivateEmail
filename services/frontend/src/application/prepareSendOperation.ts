/**
 * Application use-case: resolve recipient, encrypt message, prepare send UserOp with quote.
 */

import { keccak256 } from "viem";
import type { ContractsConfig } from "../lib/config";
import type { AaConfig, SponsorQuote } from "../lib/aa";
import { getQuoteAndPreparedOpForSendMessage } from "../lib/aa";
import { createMailClient, getAddressForUsername } from "../lib/contracts";
import { encryptWithPublicKey, bytesToHex, hexToBytes } from "../lib/crypto";
import type { Address } from "viem";

export interface PrepareSendInput {
  config: ContractsConfig;
  rpcUrl: string;
  aaConfig: AaConfig;
  recipientUsername: string;
  messageText: string;
  ownerPrivateKeyHex: `0x${string}`;
}

export interface PrepareSendResult {
  preparedUserOp: Record<string, unknown>;
  quote: SponsorQuote;
  sendOp: {
    mailAddress: Address;
    recipient: Address;
    ciphertextHex: `0x${string}`;
    contentHash: `0x${string}`;
    ownerPrivateKeyHex: `0x${string}`;
  };
}

export async function prepareSendOperation(input: PrepareSendInput): Promise<PrepareSendResult> {
  const resolved = await getAddressForUsername(input.config, input.rpcUrl, input.recipientUsername);
  if (!resolved) {
    throw new Error("Invalid recipient: username not found");
  }

  const recipientPubKey = await createMailClient(input.config, input.rpcUrl).read.getPublicKey([
    resolved,
  ]);
  const pk = recipientPubKey as string | Uint8Array | unknown;
  if (!pk || (typeof pk === "string" ? pk.length === 0 : (pk as Uint8Array).length === 0)) {
    throw new Error("Recipient has not registered a public key");
  }

  const plaintext = new TextEncoder().encode(input.messageText);
  const recipPub =
    typeof pk === "string"
      ? hexToBytes(pk as `0x${string}`)
      : new Uint8Array(pk as ArrayBuffer);
  const { ciphertext } = encryptWithPublicKey(plaintext, recipPub);
  const contentHash = keccak256(plaintext);
  const ciphertextHex = bytesToHex(ciphertext) as `0x${string}`;

  const sendOp = {
    mailAddress: input.config.PrivateMail.address as Address,
    recipient: resolved,
    ciphertextHex,
    contentHash,
    ownerPrivateKeyHex: input.ownerPrivateKeyHex,
  };

  const { preparedUserOp, quote } = await getQuoteAndPreparedOpForSendMessage(
    input.aaConfig,
    sendOp
  );

  return {
    preparedUserOp: preparedUserOp as Record<string, unknown>,
    quote,
    sendOp,
  };
}
