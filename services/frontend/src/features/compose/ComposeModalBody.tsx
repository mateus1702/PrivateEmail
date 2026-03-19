/**
 * Compose modal body: fields, validation error, and send success state.
 */

import type { UseComposeFlowResult } from "./useComposeFlow";
import { Input, Textarea, Icon } from "../../components/ui";
import styles from "./ComposeModal.module.css";

export interface ComposeModalBodyProps {
  compose: Pick<
    UseComposeFlowResult,
    | "recipientAddr"
    | "setRecipientAddr"
    | "messageText"
    | "setMessageText"
    | "composeError"
    | "sendSuccess"
    | "clearComposeError"
  >;
}

export function ComposeModalBody({ compose }: ComposeModalBodyProps) {
  const {
    recipientAddr,
    setRecipientAddr,
    messageText,
    setMessageText,
    composeError,
    sendSuccess,
    clearComposeError,
  } = compose;

  return (
    <>
      <p className={styles.supportCopy}>
        Gas is paid in USDC and may include a small Private Mail service fee.
      </p>
      <Input
        placeholder="Recipient (username)"
        value={recipientAddr}
        onChange={(e) => {
          setRecipientAddr(e.target.value);
          if (composeError) clearComposeError();
        }}
        data-testid="compose-recipient"
      />
      <Textarea
        placeholder="Message"
        value={messageText}
        onChange={(e) => {
          setMessageText(e.target.value);
          if (composeError) clearComposeError();
        }}
        data-testid="compose-message"
      />
      {composeError ? (
        <p className={styles.errorBlock} role="alert" data-testid="compose-error">
          {composeError}
        </p>
      ) : null}
      {sendSuccess && (
        <p className={styles.successBlock} role="status">
          <Icon name="success" size="sm" decorative tone="success" className={styles.successIcon} />
          Sent. Tx: {sendSuccess.slice(0, 18)}…
        </p>
      )}
    </>
  );
}
