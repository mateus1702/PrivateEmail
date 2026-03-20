/**
 * Registration / activation step: username, funding address, balance, activate.
 */

import type { UseAuthFlowResult } from "../useAuthFlow";
import { Button, Input, IconButton, Icon } from "../../../components/ui";
import styles from "../AuthPanel.module.css";

export interface AuthActivationFormProps {
  auth: UseAuthFlowResult;
  error: string | null;
  copyText: (value: string | null) => Promise<void>;
  onCloseModal: () => void;
}

export function AuthActivationForm({
  auth,
  error,
  copyText,
  onCloseModal,
}: AuthActivationFormProps) {
  const {
    registerUsername,
    setRegisterUsername,
    derivedAddress,
    usdcBalance,
    showWhaleFunding,
    isRefreshing,
    isFunding,
    isRegistering,
    registerSuccess,
    handleRefreshBalance,
    handleLoadFromWhale,
    handleCompleteRegistration,
    handleBack,
    formatUnits,
  } = auth;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        startIcon="chevronLeft"
        title="Back to login"
        aria-label="Back to login"
        className={styles.backButton}
      >
        Back
      </Button>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleWrap}>
          <h2 id="auth-card-title" className={styles.cardTitle}>
            Activate Account
          </h2>
          <p className={styles.cardDescription}>
            Pick your username and activate. The next step shows the estimated USDC cost (gas and service fees)
            before you confirm.
          </p>
        </div>
        <IconButton aria-label="Close" onClick={onCloseModal} className={styles.closeButton}>
          <Icon name="close" size="md" decorative />
        </IconButton>
      </div>
      <Input
        id="register-username"
        label="Username"
        placeholder="yourname (3-32 characters)"
        value={registerUsername}
        onChange={(e) => setRegisterUsername(e.target.value.toLowerCase())}
        data-testid="auth-username"
      />
      <p className={styles.footnote}>
        The account below is your smart account address (Polygon). Usage charges are paid in USDC and can
        include a small Private Mail fee on top of gas.
      </p>
      <div className={styles.addressRow}>
        <div className={styles.addressContent}>
          <code title={derivedAddress ?? ""}>{derivedAddress ?? ""}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copyText(derivedAddress)}
            title="Copy"
            startIcon="copy"
            data-testid="auth-copy-address"
          >
            Copy Address
          </Button>
        </div>
      </div>
      <p className={styles.balanceText}>
        <strong>USDC balance:</strong> {usdcBalance !== null ? formatUnits(usdcBalance, 6) : "—"}
      </p>
      <Button
        variant="secondary"
        size="md"
        onClick={handleRefreshBalance}
        disabled={isRefreshing}
        startIcon={isRefreshing ? "loading" : "refresh"}
        data-testid="auth-refresh-balance"
      >
        {isRefreshing ? "Refreshing..." : "Refresh Balance"}
      </Button>
      {showWhaleFunding && (
        <Button
          variant="secondary"
          size="md"
          onClick={handleLoadFromWhale}
          disabled={isFunding}
          data-testid="auth-whale-fund"
        >
          {isFunding ? "Loading..." : "Load 0.5 USDC from Test Whale"}
        </Button>
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={handleCompleteRegistration}
        disabled={isRegistering}
        className={styles.primaryBtn}
        data-testid="auth-activate"
      >
        {isRegistering ? "Activating..." : "Activate My Account"}
      </Button>
      {registerSuccess && (
        <p className={styles.successBlock}>Registered. Tx: {registerSuccess.slice(0, 18)}…</p>
      )}
      {error && <p className={styles.errorBlock}>{error}</p>}
    </>
  );
}
