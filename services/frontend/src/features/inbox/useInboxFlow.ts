/**
 * Inbox flow hook: load pages, poll, decrypt, read state.
 * Uses React Query for inbox/balance, Zustand for UI state.
 * Inbox auto-refresh uses a 30s interval with silent poll flag (no global overlay).
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
import { useGlobalLoadingStore } from "../../state/stores";

const INBOX_POLL_MS = 30_000;

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
  /** True only while the user clicked footer balance refresh (not interval). */
  isUserBalanceRefresh: boolean;
  /** For global overlay: inbox fetch while not a silent background poll. */
  overlayInboxBlocking: boolean;
  /** For global overlay: first USDC balance load only. */
  overlayBalanceInitialBlocking: boolean;
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

  const setSilentInboxPollActive = useGlobalLoadingStore((s) => s.setSilentInboxPollActive);
  const silentInboxPollActive = useGlobalLoadingStore((s) => s.silentInboxPollActive);

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
  const [isUserBalanceRefresh, setIsUserBalanceRefresh] = useState(false);

  useEffect(() => {
    if (!sessionAddress) {
      setReadMessageKeys(new Set());
      return;
    }
    setReadMessageKeys(loadReadKeys(sessionAddress));
  }, [sessionAddress]);

  useEffect(() => {
    if (!config || !env || !sessionAddress) return;
    const rpcUrl = env.VITE_RPC_URL;
    const addr = sessionAddress;
    const id = window.setInterval(() => {
      void (async () => {
        setSilentInboxPollActive(true);
        try {
          await queryClient.refetchQueries({
            queryKey: queryKeys.inboxList(rpcUrl, addr),
          });
        } finally {
          setSilentInboxPollActive(false);
        }
      })();
    }, INBOX_POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [config, env, sessionAddress, queryClient, setSilentInboxPollActive]);

  const handleRefreshSessionBalance = useCallback(async () => {
    if (!sessionAddress) return;
    setError(null);
    setIsUserBalanceRefresh(true);
    try {
      const { error } = await balanceQuery.refetch();
      if (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setIsUserBalanceRefresh(false);
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
      const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
      beginBlocking();
      try {
        const ciphertext = await getFullCiphertext(config, env.VITE_RPC_URL, msg);
        const { privateKey } = deriveEncryptionKeyPair(hexToBytes(sessionOwnerPrivateKeyHex));
        const combined = hexToBytes(ciphertext);
        const plaintext = decryptWithPrivateKey(combined, privateKey);
        setDecryptedContent(new TextDecoder().decode(plaintext));
      } catch (e) {
        const err = e instanceof Error ? e.message : "Failed to decrypt";
        setDecryptError(err);
      } finally {
        endBlocking();
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

  const inboxFetching = inboxQuery.isFetching || inboxQuery.isFetchingNextPage;
  const overlayInboxBlocking = inboxFetching && !silentInboxPollActive;
  const overlayBalanceInitialBlocking =
    balanceQuery.isFetching && balanceQuery.data === undefined;

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
    isUserBalanceRefresh,
    overlayInboxBlocking,
    overlayBalanceInitialBlocking,
    getMessageKey,
    isDecrypting,
    decryptError,
  };
}
