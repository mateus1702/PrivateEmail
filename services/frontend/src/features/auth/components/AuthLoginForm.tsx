/**
 * Login step: birthday + password fields inside the auth card.
 */

import type { UseAuthFlowResult } from "../useAuthFlow";
import { Button, Input, IconButton, Icon } from "../../../components/ui";
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
            Create or Access Your Inbox
          </h2>
          <p className={styles.cardDescription}>
            Enter the same birthday and password to open your encrypted mailbox.
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
          {isContinueLoading ? "Securing your inbox..." : "Secure My Inbox"}
        </Button>
      </form>
      <p className={styles.footnote}>
        No wallet popup required. Your smart account is created behind the scenes, and gas is charged in
        USDC with a small Private Mail fee when applicable.
      </p>
      {error && <p className={styles.errorBlock}>{error}</p>}
    </>
  );
}
