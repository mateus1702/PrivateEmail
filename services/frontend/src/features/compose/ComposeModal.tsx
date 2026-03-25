/**
 * Compose modal: recipient input, message input, send action.
 * Uses shared Modal primitive and design system components.
 */

import type { UseComposeFlowResult } from "./useComposeFlow";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from "../../components/ui";
import { ComposeModalBody } from "./ComposeModalBody";

export interface ComposeModalProps {
  compose: UseComposeFlowResult;
}

export function ComposeModal({ compose }: ComposeModalProps) {
  const {
    isSending,
    composeModalOpen,
    setComposeModalOpen,
    handleSend,
    clearSendSuccess,
    clearComposeError,
  } = compose;

  const handleClose = () => {
    setComposeModalOpen(false);
    clearSendSuccess();
    clearComposeError();
  };

  return (
    <Modal
      open={composeModalOpen}
      onClose={handleClose}
      closeOnOverlayClick
      closeOnEscape
      data-testid="compose-modal"
    >
      <ModalHeader onClose={handleClose} titleIcon="compose">
        New On-Chain Message
      </ModalHeader>
      <ModalBody>
        <ComposeModalBody compose={compose} />
      </ModalBody>
      <ModalFooter>
        <Button
          variant="ghost"
          modalContext
          onClick={handleClose}
          startIcon="close"
          data-testid="compose-close"
        >
          Close
        </Button>
        <Button
          variant="primary"
          modalContext
          onClick={handleSend}
          disabled={isSending}
          startIcon={isSending ? "loading" : "send"}
          data-testid="compose-send"
        >
          {isSending ? "Sending…" : "Send Gaslessly"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
