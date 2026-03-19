/**
 * Compose flow hook: recipient resolution, encryption, quote preparation.
 */

import { useState } from "react";
import { getReferralContext } from "../../lib/config";
import { buildAaConfig } from "../../lib/aaConfig";
import { prepareSendOperation } from "../../application";
import type { ContractsConfig } from "../../lib/config";
import type { EnvConfig } from "../../lib/config";
import type { SponsorQuote } from "../../lib/aa";
import type { CostModalSendPayload } from "../shared/types";

export interface UseComposeFlowInput {
  config: ContractsConfig | null;
  env: EnvConfig | null;
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
  handleSend: () => Promise<void>;
  clearSendSuccess: () => void;
  clearComposeError: () => void;
}

export function useComposeFlow(input: UseComposeFlowInput): UseComposeFlowResult {
  const {
    config,
    env,
    sessionOwnerPrivateKeyHex,
    setError,
    onOpenCostModal,
  } = input;

  const [recipientAddr, setRecipientAddr] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [composeModalOpen, setComposeModalOpen] = useState(false);

  const handleSend = async () => {
    setError(null);
    setComposeError(null);
    const trimmedRecipient = recipientAddr.trim();
    const trimmedMessage = messageText.trim();

    if (!config || !env) {
      setError("App config is still loading. Please try again.");
      setComposeError("App config is still loading. Please try again.");
      return;
    }
    if (!sessionOwnerPrivateKeyHex) {
      setError("Session expired. Please log in again.");
      setComposeError("Session expired. Please log in again.");
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setComposeError(msg);
    } finally {
      setIsSending(false);
    }
  };

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
    handleSend,
    clearSendSuccess: () => setSendSuccess(null),
    clearComposeError: () => setComposeError(null),
  };
}
