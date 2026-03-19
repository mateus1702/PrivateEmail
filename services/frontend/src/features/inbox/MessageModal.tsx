/**
 * Message modal: displays decrypted message content.
 * Uses shared Modal primitive and design system components.
 */

import type { UseInboxFlowResult } from "./useInboxFlow";
import { Modal, ModalHeader, ModalBody, Button } from "../../components/ui";
import styles from "./MessageModal.module.css";

export interface MessageModalProps {
  inbox: UseInboxFlowResult;
}

export function MessageModal({ inbox }: MessageModalProps) {
  const {
    selectedMessage,
    decryptedContent,
    decryptError,
    isDecrypting,
    handleRetryDecrypt,
    senderUsernames,
    messageModalOpen,
    setMessageModalOpen,
  } = inbox;

  return (
    <Modal
      open={!!messageModalOpen && !!selectedMessage}
      onClose={() => setMessageModalOpen(false)}
      closeOnOverlayClick
      closeOnEscape
      data-testid="message-modal"
    >
      <ModalHeader
        onClose={() => setMessageModalOpen(false)}
        titleIcon="message"
      >
        Message
      </ModalHeader>
      <ModalBody>
        <p className={styles.sender}>
          From:{" "}
          {selectedMessage
            ? senderUsernames.get(selectedMessage.sender.toLowerCase()) ??
              "Unknown"
            : "—"}
        </p>
        <div className={styles.content}>
          {isDecrypting
            ? "Decrypting…"
            : decryptError
              ? decryptError
              : decryptedContent ?? "No message content"}
        </div>
        {decryptError ? (
          <Button
            variant="secondary"
            modalContext
            onClick={() => void handleRetryDecrypt()}
            disabled={isDecrypting}
            startIcon={isDecrypting ? "loading" : "refresh"}
            data-testid="message-retry"
          >
            {isDecrypting ? "Retrying..." : "Retry decrypt"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          modalContext
          onClick={() => setMessageModalOpen(false)}
          startIcon="close"
          data-testid="message-close"
        >
          Close
        </Button>
      </ModalBody>
    </Modal>
  );
}
