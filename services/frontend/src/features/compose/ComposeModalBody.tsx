/**
 * Compose modal body: fields, validation error, and send success state.
 */

import type { UseComposeFlowResult } from "./useComposeFlow";
import { Input, Textarea, Icon } from "../../components/ui";
import { getTxUrl } from "../../lib/explorerLinks";
import { formatGlobalErrorToast } from "../../lib/userFacingError";
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

  const txHref = sendSuccess ? getTxUrl(sendSuccess) : null;

  return (
    <>
      <p className={styles.supportCopy}>
        Tiny USDC fee sponsored via ERC-4337 – no ETH gas
      </p>
      <Input
        placeholder="Recipient username"
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
          {formatGlobalErrorToast(composeError)}
        </p>
      ) : null}
      {sendSuccess && (
        <p className={styles.successBlock} role="status">
          <Icon name="success" size="sm" decorative tone="success" className={styles.successIcon} />
          Message sent on-chain! Tx:{" "}
          {txHref ? (
            <a
              href={txHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.txLink}
            >
              {sendSuccess.slice(0, 18)}…
            </a>
          ) : (
            <span>{sendSuccess.slice(0, 18)}…</span>
          )}
        </p>
      )}
    </>
  );
}
