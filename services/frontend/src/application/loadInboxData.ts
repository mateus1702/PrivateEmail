/**
 * Application use-case: load inbox page and resolve sender usernames.
 */

import type { ContractsConfig } from "../lib/config";
import { loadInboxPage, getUsernameForAddress } from "../lib/contracts";
import type { Address } from "viem";
import type { Message } from "../lib/contracts";

export interface LoadInboxDataInput {
  config: ContractsConfig;
  rpcUrl: string;
  recipient: Address;
  pageId: bigint;
}

export interface LoadInboxDataResult {
  messages: Message[];
  prevPageId: bigint;
  hasMore: boolean;
  senderUsernames: Map<string, string | null>;
}

export async function loadInboxData(input: LoadInboxDataInput): Promise<LoadInboxDataResult> {
  const page = await loadInboxPage(
    input.config,
    input.rpcUrl,
    input.recipient,
    input.pageId
  );

  const uniqueSenders = [...new Set(page.messages.map((m) => m.sender.toLowerCase()))];
  const results = await Promise.all(
    uniqueSenders.map((addr) =>
      getUsernameForAddress(input.config, input.rpcUrl, addr as Address)
    )
  );

  const senderUsernames = new Map<string, string | null>();
  uniqueSenders.forEach((addr, i) => {
    senderUsernames.set(addr, results[i] ?? null);
  });

  return {
    messages: page.messages,
    prevPageId: page.prevPageId,
    hasMore: page.hasMore,
    senderUsernames,
  };
}
