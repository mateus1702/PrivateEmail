import type { ReactNode } from "react";
import { Button, Icon } from "../../ui";
import styles from "./InboxShell.module.css";

export interface InboxShellProps {
  username: string | null;
  usdcBalance: string | null;
  isRefreshingBalance: boolean;
  isLoadingInbox: boolean;
  onRefreshBalance: () => void;
  onRefreshInbox: () => void;
  onCompose: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function InboxShell({
  username,
  usdcBalance,
  isRefreshingBalance,
  isLoadingInbox,
  onRefreshBalance,
  onRefreshInbox,
  onCompose,
  onLogout,
  children,
}: InboxShellProps) {
  return (
    <div className={styles.inboxShell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <img
            src="/logo.svg"
            alt="Private Mail Logo"
            className={styles.logo}
          />
          <div className={styles.headerText}>
            <h1 className={styles.title}>Private Mail</h1>
            <p className={styles.subtitle}>
              Encrypted inbox powered by smart accounts
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
            <button
              type="button"
              onClick={onRefreshBalance}
              disabled={isRefreshingBalance}
              title="Refresh USDC balance"
              aria-label="Refresh USDC balance"
              className={styles.footerBalanceRefresh}
              data-testid="inbox-refresh-balance-btn"
            >
              {isRefreshingBalance ? (
                <Icon name="loading" size="sm" decorative />
              ) : (
                <Icon name="refresh" size="sm" decorative />
              )}
            </button>
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
            startIcon="compose"
            data-testid="compose-btn"
          >
            Compose
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
