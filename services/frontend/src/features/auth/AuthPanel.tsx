/**
 * Auth panel: onboarding, login, and activation UI.
 * Uses design system primitives, AuthShell layout, and shared CostModal.
 */

import type { UseAuthFlowResult } from "./useAuthFlow";
import type { SponsorQuote } from "../../lib/aa";
import type { EnvConfig } from "../../lib/config";
import type { CostModalAction } from "../shared/types";
import { CostModal } from "../cost-modal/CostModal";
import { AuthShell } from "../../components/layout";
import { getSmartAccountChainLabel } from "../../lib/chainDisplay";
import { AuthMarketingSection, AuthLoginForm, AuthActivationForm } from "./components";
import styles from "./AuthPanel.module.css";

export interface AuthPanelProps {
  auth: UseAuthFlowResult;
  env: EnvConfig | null;
  error: string | null;
  copyText: (value: string | null) => Promise<boolean>;
  costModalOpen: boolean;
  costModalQuote: SponsorQuote | null;
  /** Store action; default to register on this screen when unset. */
  costModalAction: CostModalAction | null;
  onCostModalConfirm: () => Promise<void>;
  onCloseCostModal: () => void;
  isCostConfirming: boolean;
  costStatusMessage: string | null;
  costNeedsReconfirm: boolean;
}

export function AuthPanel({
  auth,
  env,
  error,
  copyText,
  costModalOpen,
  costModalQuote,
  costModalAction,
  onCostModalConfirm,
  onCloseCostModal,
  isCostConfirming,
  costStatusMessage,
  costNeedsReconfirm,
}: AuthPanelProps) {
  const { mobileAuthModalOpen, setMobileAuthModalOpen, authModalStep, setAuthModalStep } = auth;

  const chainIdRaw = env?.VITE_CHAIN_ID ? parseInt(env.VITE_CHAIN_ID, 10) : NaN;
  const chainLabel = env && !Number.isNaN(chainIdRaw) ? getSmartAccountChainLabel(chainIdRaw) : "Unknown chain";

  const closeAuthModal = () => {
    setMobileAuthModalOpen(false);
    setAuthModalStep("login");
  };

  const openAuthModal = () => {
    setAuthModalStep("login");
    setMobileAuthModalOpen(true);
  };

  return (
    <>
      <AuthShell>
        <AuthMarketingSection onOpenAuth={openAuthModal} />

        {mobileAuthModalOpen && (
          <div
            className={styles.backdrop}
            onClick={closeAuthModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                closeAuthModal();
              }
            }}
            aria-label="Close inbox access modal backdrop"
          />
        )}

        <div
          className={`${styles.card} ${styles.cardMobile} ${
            mobileAuthModalOpen ? styles.cardMobileOpen : ""
          }`}
          role="dialog"
          aria-modal={mobileAuthModalOpen}
          aria-labelledby="auth-card-title"
        >
          {authModalStep === "login" ? (
            <AuthLoginForm auth={auth} error={error} onCloseModal={closeAuthModal} />
          ) : (
            <AuthActivationForm
              auth={auth}
              chainLabel={chainLabel}
              error={error}
              copyText={copyText}
              onCloseModal={closeAuthModal}
            />
          )}
        </div>
      </AuthShell>

      <CostModal
        open={costModalOpen}
        quote={costModalQuote}
        action={costModalAction ?? "register"}
        onConfirm={onCostModalConfirm}
        onClose={onCloseCostModal}
        isConfirming={isCostConfirming}
        statusMessage={costStatusMessage}
        needsReconfirm={costNeedsReconfirm}
      />
    </>
  );
}
