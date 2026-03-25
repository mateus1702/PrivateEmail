/**
 * Cost confirmation modal: displays quote and confirm/cancel.
 * Uses shared Modal primitive and design system components.
 */

import type { SponsorQuote } from "../../lib/aa";
import type { CostModalAction } from "../shared/types";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from "../../components/ui";
import styles from "./CostModal.module.css";

export interface CostModalProps {
  open: boolean;
  quote: SponsorQuote | null;
  action: CostModalAction | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isConfirming?: boolean;
  statusMessage?: string | null;
  needsReconfirm?: boolean;
}

export function CostModal({
  open,
  quote,
  action,
  onConfirm,
  onClose,
  isConfirming = false,
  statusMessage = null,
  needsReconfirm = false,
}: CostModalProps) {
  const usdcApprox = quote
    ? (Number(quote.maxTotalCostUsdcE6) / 1e6).toFixed(4)
    : "0.0000";
  const title =
    action === "register"
      ? `Confirm On-Chain Activation (~${usdcApprox} USDC)`
      : `Confirm Gasless Send (~${usdcApprox} USDC)`;

  return (
    <Modal
      open={!!open && !!quote}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      data-testid="cost-modal"
    >
      <ModalHeader onClose={onClose} titleIcon="warning" titleClassName={styles.modalTitle}>
        {title}
      </ModalHeader>
      <ModalBody>
        <p className={styles.supportCopy}>
          <strong>Estimated cost:</strong>{" "}
          {quote
            ? (Number(quote.maxTotalCostUsdcE6) / 1e6).toFixed(4)
            : "0"}{" "}
          USDC
        </p>
        {quote ? (
          <p className={styles.feeNote}>
            Total shown includes estimated network costs and the Private Mail service fee.
          </p>
        ) : null}
        {statusMessage ? (
          <p className={styles.statusHint} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" modalContext onClick={onClose} disabled={isConfirming}>
          Cancel
        </Button>
        <Button
          variant="primary"
          modalContext
          onClick={() => void onConfirm()}
          disabled={isConfirming}
        >
          {isConfirming ? "Processing..." : needsReconfirm ? "Confirm Updated Cost" : "Confirm"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
