/**
 * Cost modal confirm flow: quote refresh on expiry, submit, and branching.
 */

import { isQuoteExpired } from "../../lib/aa";
import type { SendMessageOp, SponsorQuote } from "../../lib/aa";
import { formatUnits, type Address } from "viem";
import {
  prepareRegisterOperation,
  refreshPreparedSendOperation,
  submitPreparedOperation,
} from "../../application";
import { getUsdcBalance } from "../../lib/contracts";
import type { ContractsConfig } from "../../lib/config";
import type { CostModalRegisterPayload, CostModalSendPayload } from "../shared/types";
import { useCallback, useState } from "react";
import { useGlobalLoadingStore } from "../../state/stores";

export interface UseCostModalConfirmInput {
  config: ContractsConfig | null;
  env: { VITE_RPC_URL: string } | null;
  costModalQuote: SponsorQuote | null;
  costModalPreparedOp: Record<string, unknown> | null;
  costModalAction: "register" | "send" | null;
  costModalPayload: CostModalRegisterPayload | CostModalSendPayload | null;
  derivedAddress: string | null;
  derivedPubKeyHex: `0x${string}` | null;
  /** Logged-in smart account; used with send action for balance check. */
  sessionAddress: string | null;
  resetCostModal: () => void;
  setQuote: (q: SponsorQuote) => void;
  setPreparedOp: (op: Record<string, unknown>) => void;
  setError: (err: string | null) => void;
  onRegisterSuccess: (opts: { hash: string; username: string }) => void;
  onSendSuccess: (hash: `0x${string}`) => void;
}

export function useCostModalConfirm(input: UseCostModalConfirmInput) {
  const {
    config,
    env,
    costModalQuote,
    costModalPreparedOp,
    costModalPayload,
    costModalAction,
    derivedAddress,
    derivedPubKeyHex,
    sessionAddress,
    resetCostModal,
    setQuote,
    setPreparedOp,
    setError,
    onRegisterSuccess,
    onSendSuccess,
  } = input;

  const [isConfirming, setIsConfirming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [needsReconfirm, setNeedsReconfirm] = useState(false);

  const resetFlowState = useCallback(() => {
    setIsConfirming(false);
    setStatusMessage(null);
    setNeedsReconfirm(false);
  }, []);

  async function handleCostModalConfirm(): Promise<void> {
    if (!costModalQuote || !costModalPreparedOp || !costModalPayload || !config || !env) return;

    const payload = costModalPayload as CostModalRegisterPayload | CostModalSendPayload;
    const aaConfig = payload.aaConfig;

    const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();

    setIsConfirming(true);
    setStatusMessage(null);
    setNeedsReconfirm(false);
    beginBlocking();
    try {
      if (isQuoteExpired(costModalQuote)) {
        try {
          setStatusMessage("Quote expired. Refreshing latest cost...");
          if (
            costModalAction === "register" &&
            "username" in payload &&
            "ownerPrivateKeyHex" in payload &&
            derivedAddress &&
            derivedPubKeyHex
          ) {
            const { preparedUserOp, quote } = await prepareRegisterOperation({
              config,
              aaConfig,
              pubKeyHex: derivedPubKeyHex,
              ownerPrivateKeyHex: payload.ownerPrivateKeyHex,
              username: payload.username,
            });
            setQuote(quote);
            setPreparedOp(preparedUserOp);
          } else if (costModalAction === "send" && "sendOp" in payload) {
            const { preparedUserOp: refreshedOp, quote: refreshedQuote } =
              await refreshPreparedSendOperation(aaConfig, payload.sendOp);
            setQuote(refreshedQuote);
            setPreparedOp(refreshedOp);
          }
          setNeedsReconfirm(true);
          setStatusMessage("Cost updated. Please review and confirm again.");
        } catch (e) {
          console.error("[cost-modal] quote refresh", e);
          setError(e instanceof Error ? e.message : String(e));
          resetCostModal();
          resetFlowState();
          return;
        }
        setIsConfirming(false);
        return;
      }

      const smartAccountForBalance =
        costModalAction === "register" && "derivedAddress" in payload
          ? payload.derivedAddress
          : sessionAddress;
      if (!smartAccountForBalance) {
        setStatusMessage(
          "Could not determine smart account address. Try closing and opening the flow again."
        );
        setIsConfirming(false);
        return;
      }

      try {
        const balance = await getUsdcBalance(
          aaConfig.rpcUrl,
          aaConfig.usdcAddress as Address,
          smartAccountForBalance as Address
        );
        const maxRequired = BigInt(costModalQuote.maxTotalCostUsdcE6);
        if (balance < maxRequired) {
          console.warn(
            "[cost-modal] insufficient USDC",
            formatUnits(maxRequired, 6),
            "max;",
            formatUnits(balance, 6),
            "balance"
          );
          setStatusMessage(
            "Low USDC. Fund your smart account to unlock gasless messaging."
          );
          setIsConfirming(false);
          return;
        }
      } catch (e) {
        setStatusMessage(
          `Could not verify USDC balance: ${e instanceof Error ? e.message : String(e)}`
        );
        setIsConfirming(false);
        return;
      }

      setStatusMessage("Submitting operation...");
      resetCostModal();

      if (
        costModalAction === "register" &&
        "username" in payload &&
        "ownerPrivateKeyHex" in payload &&
        "derivedAddress" in payload
      ) {
        setError(null);
        try {
          const hash = await submitPreparedOperation(
            aaConfig,
            costModalPreparedOp as Record<string, unknown>,
            payload.ownerPrivateKeyHex
          );
          onRegisterSuccess({ hash, username: payload.username });
        } catch (e) {
          console.error("[cost-modal] register submit", e);
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          resetFlowState();
        }
        return;
      }

      if (costModalAction === "send" && "sendOp" in payload) {
        const sendOp = payload.sendOp as SendMessageOp;
        if (!sendOp.ownerPrivateKeyHex) {
          setError("Session ended. Re-derive your address to continue.");
          resetFlowState();
          return;
        }
        setError(null);
        try {
          const sendHash = await submitPreparedOperation(
            aaConfig,
            costModalPreparedOp as Record<string, unknown>,
            sendOp.ownerPrivateKeyHex
          );
          onSendSuccess(sendHash);
        } catch (e) {
          console.error("[cost-modal] send submit", e);
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          resetFlowState();
        }
      }
    } finally {
      endBlocking();
    }
  }

  return {
    handleCostModalConfirm,
    isConfirming,
    statusMessage,
    needsReconfirm,
    resetFlowState,
  };
}
