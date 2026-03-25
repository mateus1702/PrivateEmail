import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getConfig, getEnv } from "./lib/config";
import { queryKeys } from "./state/queryKeys";
import type { ContractsConfig, EnvConfig } from "./lib/config";
import { AuthPanel } from "./features/auth";
import { InboxPanel, MessageModal, FundSmartAccountModal, useInboxFlow } from "./features/inbox";
import { ComposeModal, useComposeFlow } from "./features/compose";
import { CostModal, useCostModalConfirm } from "./features/cost-modal";
import { useAuthFlow } from "./features/auth";
import { useSessionStore, useUiStore, useGlobalLoadingStore } from "./state/stores";
import { useUsernameForAddressQuery } from "./state/queries";
import { InboxShell } from "./components/layout";
import { Toast, Icon, GlobalLoadingOverlay } from "./components/ui";
import { formatUnits } from "viem";
import { formatGlobalErrorToast } from "./lib/userFacingError";
import { getAddressUrl } from "./lib/explorerLinks";
import { getSmartAccountChainLabel } from "./lib/chainDisplay";
import "./App.css";

function App() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ContractsConfig | null>(null);
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [error, setErrorState] = useState<string | null>(null);
  const [fundCopiedToast, setFundCopiedToast] = useState(false);
  const [fundModalOpen, setFundModalOpen] = useState(false);

  const setError = useCallback((msg: string | null) => {
    if (msg) console.error("[app]", msg);
    setErrorState(msg);
  }, []);

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

  const blockingCount = useGlobalLoadingStore((s) => s.blockingCount);
  const resetGlobalBlocking = useGlobalLoadingStore((s) => s.resetBlocking);
  const setSilentInboxPollActive = useGlobalLoadingStore((s) => s.setSilentInboxPollActive);

  useEffect(() => {
    try {
      setEnv(getEnv());
      setConfig(getConfig());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const copyText = useCallback(async (value: string | null): Promise<boolean> => {
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
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
      return true;
    } catch {
      setError("Unable to copy automatically. Please copy manually.");
      return false;
    }
  }, [setError]);

  const fundChainLabel = useMemo(() => {
    if (!env?.VITE_CHAIN_ID) return "Unknown chain";
    const id = parseInt(env.VITE_CHAIN_ID, 10);
    return Number.isNaN(id) ? "Unknown chain" : getSmartAccountChainLabel(id);
  }, [env]);

  const handleOpenFundModal = useCallback(() => {
    setFundModalOpen(true);
  }, []);

  const handleFundModalCopy = useCallback(async () => {
    if (!sessionAddress) return;
    const ok = await copyText(sessionAddress);
    if (ok) {
      setFundCopiedToast(true);
      window.setTimeout(() => setFundCopiedToast(false), 3500);
    }
  }, [sessionAddress, copyText]);

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

  const showGlobalOverlay =
    blockingCount > 0 ||
    usernameQuery.isFetching ||
    inbox.overlayInboxBlocking ||
    inbox.overlayBalanceInitialBlocking;

  const compose = useComposeFlow({
    config,
    env,
    sessionAddress,
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
    onSendSuccess: (_hash) => {
      setSendToast(true);
      setTimeout(() => setSendToast(false), 4000);
      compose.resetComposeAfterSend();
      if (sessionAddress && env)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.inboxList(env.VITE_RPC_URL, sessionAddress),
        });
    },
  });

  const handleLogout = useCallback(() => {
    resetGlobalBlocking();
    setSilentInboxPollActive(false);
    logout();
    auth.setMobileAuthModalOpen(false);
    auth.setAuthModalStep("login");
    compose.setComposeModalOpen(false);
    inbox.setMessageModalOpen(false);
    resetCost();
    resetCostFlowState();
    auth.handleBack();
  }, [
    logout,
    resetCost,
    resetCostFlowState,
    auth,
    compose,
    inbox,
    resetGlobalBlocking,
    setSilentInboxPollActive,
  ]);

  const handleCloseCostModal = useCallback(() => {
    resetCost();
    resetCostFlowState();
  }, [resetCost, resetCostFlowState]);

  if (error && !config) {
    return (
      <div className="app">
        <GlobalLoadingOverlay visible={showGlobalOverlay} />
        <h1>PrivateMail</h1>
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
            <p className="error">{formatGlobalErrorToast(error)}</p>
            <p>Set all required VITE_* env vars in .env (see .env.example).</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config || !env)
    return (
      <div className="app" role="status" aria-live="polite" aria-busy="true">
        <GlobalLoadingOverlay visible={showGlobalOverlay} />
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
      <>
        <GlobalLoadingOverlay visible={showGlobalOverlay} />
        <AuthPanel
          auth={auth}
          env={env}
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
      </>
    );
  }

  return (
    <>
      <GlobalLoadingOverlay visible={showGlobalOverlay} />
      <InboxShell
        username={sessionUsername}
        usdcBalance={
          inbox.sessionUsdcBalance !== null
            ? formatUnits(inbox.sessionUsdcBalance, 6)
            : null
        }
        isUserBalanceRefresh={inbox.isUserBalanceRefresh}
        isLoadingInbox={inbox.isLoadingInbox}
        onRefreshBalance={() => void inbox.handleRefreshSessionBalance()}
        onFundSmartAccount={handleOpenFundModal}
        onRefreshInbox={() => void inbox.handleLoadInbox(false)}
        onCompose={() => void compose.requestOpenCompose()}
        isComposeOpening={compose.isComposeOpenLoading}
        onLogout={handleLogout}
      >
        <InboxPanel inbox={inbox} />
        <MessageModal inbox={inbox} />
        <ComposeModal compose={compose} />

        <CostModal
          open={costModalOpen}
          quote={costModalQuote}
          action={costModalAction ?? "register"}
          onConfirm={handleCostModalConfirm}
          onClose={handleCloseCostModal}
          isConfirming={isCostConfirming}
          statusMessage={costStatusMessage}
          needsReconfirm={costNeedsReconfirm}
        />

        <FundSmartAccountModal
          open={fundModalOpen}
          onClose={() => setFundModalOpen(false)}
          smartAccountAddress={sessionAddress}
          chainLabel={fundChainLabel}
          usdcBalance={
            inbox.sessionUsdcBalance !== null
              ? formatUnits(inbox.sessionUsdcBalance, 6)
              : null
          }
          explorerAddressUrl={
            sessionAddress ? getAddressUrl(sessionAddress) : null
          }
          onCopyAddress={handleFundModalCopy}
          onRefreshBalance={() => void inbox.handleRefreshSessionBalance()}
          isBalanceRefreshing={inbox.isUserBalanceRefresh}
        />

        {sendToast && (
          <Toast variant="success" data-testid="toast-success">
            Message sent on-chain
          </Toast>
        )}
        {fundCopiedToast && (
          <Toast variant="success" data-testid="toast-fund-copied">
            Smart account address copied — send USDC to this address on your network.
          </Toast>
        )}
        {error && (
          <Toast variant="error" data-testid="toast-error">
            {formatGlobalErrorToast(error)}
          </Toast>
        )}
      </InboxShell>
    </>
  );
}

export default App;
