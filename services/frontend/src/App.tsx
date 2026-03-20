import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getConfig, getEnv } from "./lib/config";
import { queryKeys } from "./state/queryKeys";
import type { ContractsConfig, EnvConfig } from "./lib/config";
import { AuthPanel } from "./features/auth";
import { InboxPanel, MessageModal, useInboxFlow } from "./features/inbox";
import { ComposeModal, useComposeFlow } from "./features/compose";
import { CostModal, useCostModalConfirm } from "./features/cost-modal";
import { useAuthFlow } from "./features/auth";
import { useSessionStore, useUiStore } from "./state/stores";
import { useUsernameForAddressQuery } from "./state/queries";
import { InboxShell } from "./components/layout";
import { Toast, Icon } from "./components/ui";
import { formatUnits } from "viem";
import "./App.css";

function App() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ContractsConfig | null>(null);
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionAddress = useSessionStore((s) => s.sessionAddress);
  const sessionOwnerPrivateKeyHex = useSessionStore((s) => s.sessionOwnerPrivateKeyHex);
  const login = useSessionStore((s) => s.login);
  const logout = useSessionStore((s) => s.logout);

  const screen = sessionAddress ? "logged" : "login";

  const usernameQuery = useUsernameForAddressQuery({
    config,
    rpcUrl: env?.VITE_RPC_URL ?? "",
    address: sessionAddress,
    enabled: !!config && !!env && !!sessionAddress,
  });
  const sessionUsername = usernameQuery.data ?? null;

  const costModalOpen = useUiStore((s) => s.costModalOpen);
  const costModalQuote = useUiStore((s) => s.costModalQuote);
  const costModalAction = useUiStore((s) => s.costModalAction);
  const costModalPreparedOp = useUiStore((s) => s.costModalPreparedOp);
  const costModalPayload = useUiStore((s) => s.costModalPayload);
  const setCostModalOpen = useUiStore((s) => s.setCostModalOpen);
  const setCostModalQuote = useUiStore((s) => s.setCostModalQuote);
  const setCostModalAction = useUiStore((s) => s.setCostModalAction);
  const setCostModalPreparedOp = useUiStore((s) => s.setCostModalPreparedOp);
  const setCostModalPayload = useUiStore((s) => s.setCostModalPayload);
  const resetCostModalFromStore = useUiStore((s) => s.resetCostModal);
  const sendToast = useUiStore((s) => s.sendToast);
  const setSendToast = useUiStore((s) => s.setSendToast);

  useEffect(() => {
    try {
      setEnv(getEnv());
      setConfig(getConfig());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const copyText = useCallback(async (value: string | null) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
    } catch {
      // fall through
    }
    try {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(input);
      if (!copied) throw new Error("Copy command failed");
    } catch {
      setError("Unable to copy automatically. Please copy manually.");
    }
  }, []);

  const storeSession = useCallback(
    (addr: string, ownerHex: `0x${string}`) => {
      login(addr, ownerHex);
      if (env)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.usernameByAddress(env.VITE_RPC_URL, addr),
        });
    },
    [login, env, queryClient]
  );

  const resetCost = useCallback(() => {
    resetCostModalFromStore();
  }, [resetCostModalFromStore]);

  const auth = useAuthFlow({
    config,
    env,
    setError,
    onStoreSession: storeSession,
    onOpenCostModal: ({ quote, preparedUserOp, action, payload }) => {
      setCostModalQuote(quote);
      setCostModalPreparedOp(preparedUserOp);
      setCostModalAction(action);
      setCostModalPayload(payload);
      setCostModalOpen(true);
    },
    onSessionUsernameResolved: () => {},
  });

  const inbox = useInboxFlow({
    config,
    env,
    sessionAddress,
    sessionOwnerPrivateKeyHex,
    setError,
  });

  const compose = useComposeFlow({
    config,
    env,
    sessionOwnerPrivateKeyHex,
    setError,
    onOpenCostModal: ({ quote, preparedUserOp, action, payload }) => {
      setCostModalQuote(quote);
      setCostModalPreparedOp(preparedUserOp);
      setCostModalAction(action);
      setCostModalPayload(payload);
      setCostModalOpen(true);
    },
  });

  const {
    handleCostModalConfirm,
    isConfirming: isCostConfirming,
    statusMessage: costStatusMessage,
    needsReconfirm: costNeedsReconfirm,
    resetFlowState: resetCostFlowState,
  } = useCostModalConfirm({
    config,
    env,
    costModalQuote,
    costModalPreparedOp,
    costModalAction,
    costModalPayload,
    derivedAddress: auth.derivedAddress,
    derivedPubKeyHex: auth.derivedPubKeyHex,
    sessionAddress,
    resetCostModal: resetCost,
    setQuote: setCostModalQuote,
    setPreparedOp: setCostModalPreparedOp,
    setError,
    onRegisterSuccess: auth.handleRegistrationSuccess,
    onSendSuccess: () => {
      compose.setComposeModalOpen(false);
      compose.setRecipientAddr("");
      compose.setMessageText("");
      setSendToast(true);
      setTimeout(() => setSendToast(false), 4000);
      if (sessionAddress && env)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.inboxList(env.VITE_RPC_URL, sessionAddress),
        });
    },
  });

  const handleLogout = useCallback(() => {
    logout();
    auth.setMobileAuthModalOpen(false);
    auth.setAuthModalStep("login");
    compose.setComposeModalOpen(false);
    inbox.setMessageModalOpen(false);
    resetCost();
    resetCostFlowState();
    auth.handleBack();
  }, [logout, resetCost, resetCostFlowState, auth, compose, inbox]);

  const handleCloseCostModal = useCallback(() => {
    resetCost();
    resetCostFlowState();
  }, [resetCost, resetCostFlowState]);

  if (error && !config) {
    return (
      <div className="app">
        <h1>Private Mail</h1>
        <div className="appStatus appStatusError" role="alert">
          <Icon
            name="error"
            size="lg"
            decorative={false}
            aria-label="Error"
            tone="error"
            className="appStatusIcon"
          />
          <div>
            <p className="error">{error}</p>
            <p>Set all required VITE_* env vars in .env (see .env.example).</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config || !env)
    return (
      <div className="app" role="status" aria-live="polite" aria-busy="true">
        <div className="appStatus appStatusLoading">
          <Icon
            name="loading"
            size="lg"
            decorative={false}
            aria-label="Loading configuration"
            className="appStatusIcon"
          />
          <p>Loading config…</p>
        </div>
      </div>
    );

  if (screen === "login") {
    return (
      <AuthPanel
        auth={auth}
        error={error}
        copyText={copyText}
        costModalOpen={costModalOpen}
        costModalQuote={costModalQuote}
        costModalAction={costModalAction}
        onCostModalConfirm={handleCostModalConfirm}
        onCloseCostModal={handleCloseCostModal}
        isCostConfirming={isCostConfirming}
        costStatusMessage={costStatusMessage}
        costNeedsReconfirm={costNeedsReconfirm}
      />
    );
  }

  return (
    <InboxShell
      username={sessionUsername}
      usdcBalance={
        inbox.sessionUsdcBalance !== null
          ? formatUnits(inbox.sessionUsdcBalance, 6)
          : null
      }
      isRefreshingBalance={inbox.isRefreshingSessionBalance}
      isLoadingInbox={inbox.isLoadingInbox}
      onRefreshBalance={() => void inbox.handleRefreshSessionBalance()}
      onRefreshInbox={() => void inbox.handleLoadInbox(false)}
      onCompose={() => compose.setComposeModalOpen(true)}
      onLogout={handleLogout}
    >
      <InboxPanel inbox={inbox} />
      <MessageModal inbox={inbox} />
      <ComposeModal compose={compose} />

      <CostModal
        open={costModalOpen}
        quote={costModalQuote}
        action={costModalAction}
        onConfirm={handleCostModalConfirm}
        onClose={handleCloseCostModal}
        isConfirming={isCostConfirming}
        statusMessage={costStatusMessage}
        needsReconfirm={costNeedsReconfirm}
      />

      {sendToast && (
        <Toast variant="success" data-testid="toast-success">
          Message sent successfully
        </Toast>
      )}
      {error && (
        <Toast variant="error" data-testid="toast-error">
          {error}
        </Toast>
      )}
    </InboxShell>
  );
}

export default App;
