/**
 * Inbox flow hook: load pages, poll, decrypt, read state.
 * Uses React Query for inbox/balance, Zustand for UI state.
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "../../lib/contracts";
import { getFullCiphertext } from "../../lib/contracts";
import { deriveEncryptionKeyPair, decryptWithPrivateKey, hexToBytes } from "../../lib/crypto";
import type { ContractsConfig } from "../../lib/config";
import type { EnvConfig } from "../../lib/config";
import { getMessageKey, loadReadKeys, persistReadKeys } from "./inboxStorage";
import { useInboxQuery, useSessionBalanceQuery } from "../../state/queries";
import { queryKeys } from "../../state/queryKeys";

export interface UseInboxFlowInput {
  config: ContractsConfig | null;
  env: EnvConfig | null;
  sessionAddress: string | null;
  sessionOwnerPrivateKeyHex: `0x${string}` | null;
  setError: (err: string | null) => void;
}

export interface UseInboxFlowResult {
  inboxPages: Message[];
  inboxNextPageId: bigint;
  inboxHasMore: boolean;
  isLoadingInbox: boolean;
  senderUsernames: Map<string, string | null>;
  readMessageKeys: Set<string>;
  selectedMessage: Message | null;
  decryptedContent: string | null;
  messageModalOpen: boolean;
  setMessageModalOpen: (v: boolean) => void;
  handleLoadInbox: (append: boolean) => Promise<void>;
  handleOpenMessage: (msg: Message) => Promise<void>;
  handleRetryDecrypt: () => Promise<void>;
  handleRefreshSessionBalance: () => Promise<void>;
  sessionUsdcBalance: bigint | null;
  isRefreshingSessionBalance: boolean;
  getMessageKey: (msg: Message) => string;
  isDecrypting: boolean;
  decryptError: string | null;
}

export function useInboxFlow(input: UseInboxFlowInput): UseInboxFlowResult {
  const {
    config,
    env,
    sessionAddress,
    sessionOwnerPrivateKeyHex,
    setError,
  } = input;

  const queryClient = useQueryClient();
  const usdcAddr = env?.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

  const inboxQuery = useInboxQuery({
    config,
    rpcUrl: env?.VITE_RPC_URL ?? "",
    recipient: sessionAddress,
    enabled: !!config && !!env && !!sessionAddress,
  });

  const balanceQuery = useSessionBalanceQuery({
    rpcUrl: env?.VITE_RPC_URL ?? "",
    usdcAddress: usdcAddr,
    sessionAddress,
    enabled: !!env && !!sessionAddress,
  });

  const [readMessageKeys, setReadMessageKeys] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionAddress) {
      setReadMessageKeys(new Set());
      return;
    }
    setReadMessageKeys(loadReadKeys(sessionAddress));
  }, [sessionAddress]);

  const handleRefreshSessionBalance = useCallback(async () => {
    if (!sessionAddress) return;
    setError(null);
    const { error } = await balanceQuery.refetch();
    if (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [sessionAddress, balanceQuery, setError]);

  const handleLoadInbox = useCallback(
    async (append: boolean) => {
      if (!config || !env || !sessionAddress) return;
      setError(null);
      if (append) {
        await inboxQuery.fetchNextPage();
      } else {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.inboxList(env.VITE_RPC_URL, sessionAddress),
        });
        await inboxQuery.refetch();
      }
      if (inboxQuery.error) {
        setError(
          inboxQuery.error instanceof Error ? inboxQuery.error.message : String(inboxQuery.error)
        );
      }
    },
    [config, env, sessionAddress, inboxQuery, queryClient, setError]
  );

  const decryptSelectedMessage = useCallback(
    async (msg: Message) => {
      if (!sessionOwnerPrivateKeyHex || !config || !env || !sessionAddress) return;
      setIsDecrypting(true);
      setDecryptError(null);
      setDecryptedContent(null);
      try {
        const ciphertext = await getFullCiphertext(config, env.VITE_RPC_URL, msg);
        const { privateKey } = deriveEncryptionKeyPair(hexToBytes(sessionOwnerPrivateKeyHex));
        const combined = hexToBytes(ciphertext);
        const plaintext = decryptWithPrivateKey(combined, privateKey);
        setDecryptedContent(new TextDecoder().decode(plaintext));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to decrypt";
        setDecryptError(msg);
      } finally {
        setIsDecrypting(false);
      }
    },
    [sessionOwnerPrivateKeyHex, config, env, sessionAddress]
  );

  const handleOpenMessage = useCallback(
    async (msg: Message) => {
      if (!sessionOwnerPrivateKeyHex || !config || !env || !sessionAddress) return;
      setMessageModalOpen(true);
      setSelectedMessage(msg);
      const key = getMessageKey(msg);
      setReadMessageKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        persistReadKeys(sessionAddress, next);
        return next;
      });
      await decryptSelectedMessage(msg);
    },
    [sessionOwnerPrivateKeyHex, config, env, sessionAddress, decryptSelectedMessage]
  );

  const handleRetryDecrypt = useCallback(async () => {
    if (!selectedMessage) return;
    await decryptSelectedMessage(selectedMessage);
  }, [selectedMessage, decryptSelectedMessage]);

  const pages = inboxQuery.data?.pages ?? [];
  const inboxPages = pages.flatMap((p) => p.messages);
  const senderUsernames = new Map<string, string | null>();
  for (const p of pages) {
    p.senderUsernames.forEach((v, k) => senderUsernames.set(k, v));
  }
  const lastPage = pages[pages.length - 1];
  const inboxNextPageId = lastPage?.prevPageId ?? 0n;
  const inboxHasMore = inboxQuery.hasNextPage ?? false;

  return {
    inboxPages,
    inboxNextPageId,
    inboxHasMore,
    isLoadingInbox: inboxQuery.isFetching && inboxQuery.isFetchingNextPage === false,
    senderUsernames,
    readMessageKeys,
    selectedMessage,
    decryptedContent,
    messageModalOpen,
    setMessageModalOpen,
    handleLoadInbox,
    handleOpenMessage,
    handleRetryDecrypt,
    handleRefreshSessionBalance,
    sessionUsdcBalance: balanceQuery.data ?? null,
    isRefreshingSessionBalance: balanceQuery.isFetching,
    getMessageKey,
    isDecrypting,
    decryptError,
  };
}
