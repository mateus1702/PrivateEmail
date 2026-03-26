/**
 * Where to send USDC for the smart account (same voice as activation + cost modal).
 */

import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Icon } from "../../components/ui";
import styles from "./FundSmartAccountModal.module.css";

export interface FundSmartAccountModalProps {
  open: boolean;
  onClose: () => void;
  smartAccountAddress: string | null;
  /** Human-readable network (e.g. Polygon). */
  chainLabel: string;
  /** Current USDC balance on the smart account (formatted, e.g. "1.5") or null. */
  usdcBalance: string | null;
  /** Full explorer URL for the address, or null if not configured. */
  explorerAddressUrl: string | null;
  onCopyAddress: () => void | Promise<void>;
  /** Same as footer: refetch smart-account USDC from RPC. */
  onRefreshBalance: () => void;
  isBalanceRefreshing: boolean;
}

export function FundSmartAccountModal({
  open,
  onClose,
  smartAccountAddress,
  chainLabel,
  usdcBalance,
  explorerAddressUrl,
  onCopyAddress,
  onRefreshBalance,
  isBalanceRefreshing,
}: FundSmartAccountModalProps) {
  const addr = smartAccountAddress?.trim() ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      data-testid="fund-smart-account-modal"
    >
      <ModalHeader onClose={onClose} titleIcon="wallet">
        Fund with USDC
      </ModalHeader>
      <ModalBody>
        <div className={styles.body}>
          <p className={styles.lead}>
            Usage charges are paid in <strong>USDC</strong> from your smart account on <strong>{chainLabel}</strong>.
            Send USDC to the address below — same network as this app. No ETH needed for gas.
          </p>
          <p className={styles.hint}>
            After you transfer, refresh your balance here or in the footer.
          </p>
          <div className={styles.balanceRow}>
            <div className={styles.balanceWithRefresh}>
              <span className={styles.balanceLine}>
                <strong>Smart Account USDC:</strong> {usdcBalance ?? "—"}
              </span>
              <button
                type="button"
                onClick={onRefreshBalance}
                disabled={isBalanceRefreshing}
                title="Refresh USDC balance"
                aria-label="Refresh USDC balance"
                aria-busy={isBalanceRefreshing}
                className={
                  isBalanceRefreshing
                    ? `${styles.balanceRefresh} ${styles.balanceRefreshActive}`
                    : styles.balanceRefresh
                }
                data-testid="fund-modal-refresh-balance"
              >
                <Icon
                  name="refresh"
                  size="sm"
                  decorative
                  className={isBalanceRefreshing ? styles.balanceRefreshIconSpin : undefined}
                />
              </button>
            </div>
          </div>
          {addr ? (
            <div className={styles.addressSection}>
              <div className={styles.addressBox}>
                <pre className={styles.addressText} data-testid="fund-modal-address">
                  {addr}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  startIcon="copy"
                  onClick={() => void onCopyAddress()}
                  className={styles.copyInAddressBox}
                  data-testid="fund-modal-copy"
                >
                  Copy Address
                </Button>
              </div>
              <div className={styles.chainBadgeRow}>
                <Badge variant="default" data-testid="fund-modal-chain-badge">
                  {chainLabel}
                </Badge>
              </div>
            </div>
          ) : (
            <p className={styles.hint} role="status">
              Session ended. Log in again to see your address.
            </p>
          )}
          {explorerAddressUrl ? (
            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="md"
                modalContext
                onClick={() => window.open(explorerAddressUrl, "_blank", "noopener,noreferrer")}
                data-testid="fund-modal-explorer"
              >
                View on explorer
              </Button>
            </div>
          ) : null}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" modalContext onClick={onClose} data-testid="fund-modal-close">
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
