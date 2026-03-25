/**
 * Compose flow hook: recipient resolution, encryption, quote preparation.
 */

import { useState, useCallback } from "react";
import type { Address } from "viem";
import { getReferralContext } from "../../lib/config";
import { buildAaConfig } from "../../lib/aaConfig";
import { prepareSendOperation } from "../../application";
import { getUsdcBalance } from "../../lib/contracts";
import { MIN_COMPOSE_USDC_E6 } from "../../lib/usdcThresholds";
import { runBlocking } from "../../state/stores";
import type { ContractsConfig } from "../../lib/config";
import type { EnvConfig } from "../../lib/config";
import type { SponsorQuote } from "../../lib/aa";
import type { CostModalSendPayload } from "../shared/types";

export interface UseComposeFlowInput {
  config: ContractsConfig | null;
  env: EnvConfig | null;
  sessionAddress: string | null;
  sessionOwnerPrivateKeyHex: `0x${string}` | null;
  setError: (err: string | null) => void;
  onOpenCostModal: (opts: {
    quote: SponsorQuote;
    preparedUserOp: Record<string, unknown>;
    action: "send";
    payload: CostModalSendPayload;
  }) => void;
}

export interface UseComposeFlowResult {
  recipientAddr: string;
  setRecipientAddr: (v: string) => void;
  messageText: string;
  setMessageText: (v: string) => void;
  isSending: boolean;
  composeError: string | null;
  sendSuccess: string | null;
  composeModalOpen: boolean;
  setComposeModalOpen: (v: boolean) => void;
  /** Balance check (read-only RPC), then opens modal — no UserOp until send. */
  requestOpenCompose: () => Promise<void>;
  isComposeOpenLoading: boolean;
  handleSend: () => Promise<void>;
  clearSendSuccess: () => void;
  clearComposeError: () => void;
  setSendSuccess: (hash: string) => void;
  /** After a successful on-chain send: clear draft, errors, success state, and close modal (toast is separate). */
  resetComposeAfterSend: () => void;
}

export function useComposeFlow(input: UseComposeFlowInput): UseComposeFlowResult {
  const {
    config,
    env,
    sessionAddress,
    sessionOwnerPrivateKeyHex,
    setError,
    onOpenCostModal,
  } = input;

  const [recipientAddr, setRecipientAddr] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccessState] = useState<string | null>(null);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [isComposeOpenLoading, setIsComposeOpenLoading] = useState(false);

  const requestOpenCompose = useCallback(async () => {
    setComposeError(null);
    setError(null);
    if (!config || !env) {
      setComposeError("App config is still loading. Please try again.");
      return;
    }
    if (!sessionOwnerPrivateKeyHex || !sessionAddress) {
      setComposeError("Session ended. Re-derive your address to continue.");
      return;
    }
    if (!env.VITE_BUNDLER_URL || !env.VITE_PAYMASTER_API_URL) {
      setComposeError("Bundler and Paymaster URLs required");
      return;
    }

    const usdcAddr = (env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;
    setIsComposeOpenLoading(true);
    try {
      try {
        const balance = await getUsdcBalance(env.VITE_RPC_URL, usdcAddr, sessionAddress as Address);
        if (balance < MIN_COMPOSE_USDC_E6) {
          setComposeError(
            "Your smart account needs at least 0.1 USDC to compose a message. Fund it to continue."
          );
          return;
        }
      } catch (e) {
        setComposeError(
          `Could not verify USDC balance: ${e instanceof Error ? e.message : String(e)}`
        );
        return;
      }
      setComposeModalOpen(true);
    } finally {
      setIsComposeOpenLoading(false);
    }
  }, [config, env, sessionAddress, sessionOwnerPrivateKeyHex, setError]);

  const handleSend = async () => {
    setError(null);
    setComposeError(null);
    const trimmedRecipient = recipientAddr.trim().replace(/^@+/, "");
    const trimmedMessage = messageText.trim();

    if (!config || !env) {
      setError("App config is still loading. Please try again.");
      setComposeError("App config is still loading. Please try again.");
      return;
    }
    if (!sessionOwnerPrivateKeyHex) {
      setError("Session ended. Re-derive your address to continue.");
      setComposeError("Session ended. Re-derive your address to continue.");
      return;
    }
    if (!trimmedRecipient) {
      setError("Please enter a recipient username");
      setComposeError("Please enter a recipient username");
      return;
    }
    if (!trimmedMessage) {
      setError("Please enter a message");
      setComposeError("Please enter a message");
      return;
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmedRecipient)) {
      setError("Enter recipient by username only");
      setComposeError("Enter recipient by username only");
      return;
    }
    if (!env.VITE_BUNDLER_URL || !env.VITE_PAYMASTER_API_URL) {
      setError("Bundler and Paymaster URLs required");
      setComposeError("Bundler and Paymaster URLs required");
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await runBlocking(async () => {
        const aaConfig = buildAaConfig(env, getReferralContext());
        const { preparedUserOp, quote, sendOp } = await prepareSendOperation({
          config,
          rpcUrl: env.VITE_RPC_URL,
          aaConfig,
          recipientUsername: trimmedRecipient,
          messageText: trimmedMessage,
          ownerPrivateKeyHex: sessionOwnerPrivateKeyHex,
        });
        const payload: CostModalSendPayload = {
          aaConfig,
          sendOp,
        };
        onOpenCostModal({ quote, preparedUserOp, action: "send", payload });
      });
    } catch (e) {
      console.error("[compose/send]", e);
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setComposeError(msg);
    } finally {
      setIsSending(false);
    }
  };

  const resetComposeAfterSend = useCallback(() => {
    setRecipientAddr("");
    setMessageText("");
    setComposeError(null);
    setSendSuccessState(null);
    setComposeModalOpen(false);
  }, []);

  return {
    recipientAddr,
    setRecipientAddr,
    messageText,
    setMessageText,
    isSending,
    composeError,
    sendSuccess,
    composeModalOpen,
    setComposeModalOpen,
    requestOpenCompose,
    isComposeOpenLoading,
    handleSend,
    clearSendSuccess: () => setSendSuccessState(null),
    clearComposeError: () => setComposeError(null),
    setSendSuccess: (hash: string) => setSendSuccessState(hash),
    resetComposeAfterSend,
  };
}
