/**
 * Login step: birthday + password fields inside the auth card.
 */

import type { UseAuthFlowResult } from "../useAuthFlow";
import { Button, Input, IconButton, Icon } from "../../../components/ui";
import { formatGlobalErrorToast } from "../../../lib/userFacingError";
import styles from "../AuthPanel.module.css";

export interface AuthLoginFormProps {
  auth: UseAuthFlowResult;
  error: string | null;
  onCloseModal: () => void;
}

export function AuthLoginForm({ auth, error, onCloseModal }: AuthLoginFormProps) {
  const {
    birthday,
    setBirthday,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    isContinueLoading,
    handleContinue,
    formatBirthdayInput,
  } = auth;

  return (
    <>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleWrap}>
          <h2 id="auth-card-title" className={styles.cardTitle}>
            Access Your On-Chain Inbox
          </h2>
          <p className={styles.cardDescription}>
            Enter your birthday and password to derive your smart account. Everything happens locally –
            your keys, your control.
          </p>
        </div>
        <IconButton aria-label="Close" onClick={onCloseModal} className={styles.closeButton}>
          <Icon name="close" size="md" decorative />
        </IconButton>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleContinue();
        }}
      >
        <Input
          id="birthday"
          label="Birthday"
          type="text"
          inputMode="numeric"
          placeholder="MM/DD/YYYY"
          value={birthday}
          onChange={(e) => setBirthday(formatBirthdayInput(e.target.value))}
          data-testid="auth-birthday"
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="auth-password"
        />
        <Input
          id="confirm-password"
          label="Confirm Password"
          type="password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          data-testid="auth-confirm-password"
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isContinueLoading}
          className={styles.primaryBtn}
          data-testid="auth-submit"
        >
          {isContinueLoading ? "Deriving sovereign address…" : "Continue to my inbox"}
        </Button>
      </form>
      <p className={styles.footnote}>
        A small USDC balance powers gasless magic via ERC-4337. No ETH needed.
      </p>
      {error && <p className={styles.errorBlock}>{formatGlobalErrorToast(error)}</p>}
    </>
  );
}
