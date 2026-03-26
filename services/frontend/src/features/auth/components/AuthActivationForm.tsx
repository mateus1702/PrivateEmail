/**
 * Registration / activation step: username, funding address, balance, activate.
 */

import type { UseAuthFlowResult } from "../useAuthFlow";
import { Badge, Button, Input, IconButton, Icon } from "../../../components/ui";
import { getTxUrl } from "../../../lib/explorerLinks";
import { formatGlobalErrorToast } from "../../../lib/userFacingError";
import styles from "../AuthPanel.module.css";

export interface AuthActivationFormProps {
  auth: UseAuthFlowResult;
  /** Network label for the smart account (e.g. Polygon). */
  chainLabel: string;
  error: string | null;
  copyText: (value: string | null) => Promise<boolean>;
  onCloseModal: () => void;
}

export function AuthActivationForm({
  auth,
  chainLabel,
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
    activatedUsername,
    handleRefreshBalance,
    handleLoadFromWhale,
    handleCompleteRegistration,
    handleBack,
    formatUnits,
  } = auth;

  const showWhale = showWhaleFunding && !import.meta.env.PROD;
  const activationTxHref = registerSuccess ? getTxUrl(registerSuccess) : null;

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
            Activate & Claim Your Username
          </h2>
          <p className={styles.cardDescription}>
            Choose your public username and activate. This registers your encryption key on-chain – one-time,
            forever.
          </p>
        </div>
        <IconButton aria-label="Close" onClick={onCloseModal} className={styles.closeButton}>
          <Icon name="close" size="md" decorative />
        </IconButton>
      </div>
      <Input
        id="register-username"
        label="Username"
        placeholder="Username (3–32 characters)"
        value={registerUsername}
        onChange={(e) => setRegisterUsername(e.target.value.toLowerCase().replace(/^@+/, ""))}
        data-testid="auth-username"
      />
      <p className={styles.footnote}>
        The account below is your smart account address on <strong>{chainLabel}</strong>. Usage charges are
        paid in USDC and can include a small Private Mail fee on top of gas.
      </p>
      <div className={styles.addressRow}>
        <div className={styles.addressChainRow}>
          <Badge
            id="auth-smart-account-chain-badge"
            variant="default"
            data-testid="auth-chain-badge"
          >
            {chainLabel}
          </Badge>
          <span className={styles.addressChainHint}>Smart account</span>
        </div>
        <div className={styles.addressContent}>
          <code
            id="auth-derived-smart-account-address"
            aria-describedby="auth-smart-account-chain-badge"
            title={derivedAddress ?? ""}
          >
            {derivedAddress ?? ""}
          </code>
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
        <strong>Smart Account USDC:</strong> {usdcBalance !== null ? formatUnits(usdcBalance, 6) : "—"}
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
      {showWhale && (
        <Button
          variant="secondary"
          size="md"
          onClick={handleLoadFromWhale}
          disabled={isFunding}
          data-testid="auth-whale-fund"
        >
          {isFunding ? "Loading..." : "Local Test: Fund 0.5 USDC"}
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
      {registerSuccess && activatedUsername ? (
        <p className={styles.successBlock}>
          Activated! Your @{activatedUsername} is live on-chain. Tx:{" "}
          {activationTxHref ? (
            <a
              href={activationTxHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.successTxLink}
            >
              {registerSuccess.slice(0, 18)}…
            </a>
          ) : (
            <span>{registerSuccess.slice(0, 18)}…</span>
          )}
        </p>
      ) : null}
      {error && <p className={styles.errorBlock}>{formatGlobalErrorToast(error)}</p>}
    </>
  );
}
