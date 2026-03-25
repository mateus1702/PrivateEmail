import type { ReactNode } from "react";
import { Button, Icon } from "../../ui";
import styles from "./InboxShell.module.css";

export interface InboxShellProps {
  username: string | null;
  usdcBalance: string | null;
  /** User-initiated footer balance refresh (spin animation; not interval). */
  isUserBalanceRefresh: boolean;
  isLoadingInbox: boolean;
  onRefreshBalance: () => void;
  /** Open funding help modal (smart account details and how to add USDC). */
  onFundSmartAccount: () => void;
  onRefreshInbox: () => void;
  onCompose: () => void;
  /** True while USDC balance check runs before opening compose (read-only RPC). */
  isComposeOpening?: boolean;
  onLogout: () => void;
  children: ReactNode;
}

export function InboxShell({
  username,
  usdcBalance,
  isUserBalanceRefresh,
  isLoadingInbox,
  onRefreshBalance,
  onFundSmartAccount,
  onRefreshInbox,
  onCompose,
  isComposeOpening = false,
  onLogout,
  children,
}: InboxShellProps) {
  return (
    <div className={styles.inboxShell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <img
            src="/logo.svg"
            alt="PrivateMail logo"
            className={styles.logo}
          />
          <div className={styles.headerText}>
            <h1 className={styles.title}>PrivateMail</h1>
            <p className={styles.subtitle}>
              Chain-native • End-to-end encrypted • Gasless
            </p>
          </div>
        </div>
      </header>

      <main className={styles.content}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.footerUsername}>
            <strong>User:</strong> {username ?? "—"}
          </div>
          <div className={styles.footerBalance}>
            <strong>USDC:</strong> {usdcBalance ?? "—"}
            <div className={styles.footerBalanceActions}>
              <button
                type="button"
                onClick={onRefreshBalance}
                disabled={isUserBalanceRefresh}
                title="Refresh USDC balance"
                aria-label="Refresh USDC balance"
                aria-busy={isUserBalanceRefresh}
                className={
                  isUserBalanceRefresh
                    ? `${styles.footerBalanceRefresh} ${styles.footerBalanceRefreshActive}`
                    : styles.footerBalanceRefresh
                }
                data-testid="inbox-refresh-balance-btn"
              >
                <Icon
                  name="refresh"
                  size="sm"
                  decorative
                  className={isUserBalanceRefresh ? styles.balanceRefreshIconSpin : undefined}
                />
              </button>
              <Button
                variant="secondary"
                size="md"
                onClick={onFundSmartAccount}
                startIcon="wallet"
                title="Fund with USDC"
                data-testid="inbox-fund-btn"
              >
                Fund
              </Button>
            </div>
          </div>
        </div>
        <div className={styles.footerActions}>
          <Button
            variant="ghost"
            size="md"
            onClick={onRefreshInbox}
            disabled={isLoadingInbox}
            title="Refresh inbox"
            startIcon={isLoadingInbox ? "loading" : "refresh"}
            data-testid="inbox-refresh-btn"
          >
            {isLoadingInbox ? "Refreshing…" : "Refresh inbox"}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onCompose}
            disabled={isComposeOpening}
            startIcon={isComposeOpening ? "loading" : "compose"}
            data-testid="compose-btn"
          >
            {isComposeOpening ? "Opening…" : "Compose"}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onLogout}
            startIcon="logout"
            data-testid="logout-btn"
          >
            Logout
          </Button>
        </div>
      </footer>
    </div>
  );
}
