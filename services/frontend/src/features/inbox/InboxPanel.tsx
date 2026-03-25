/**
 * Inbox panel: message list and load-more.
 * Uses design system primitives and CSS modules.
 */

import type { UseInboxFlowResult } from "./useInboxFlow";
import { Button, Icon } from "../../components/ui";
import { InboxHeader } from "./InboxHeader";
import { InboxListItem } from "./InboxListItem";
import styles from "./InboxPanel.module.css";

export type { InboxListItemProps } from "./InboxListItem";

export interface InboxPanelProps {
  inbox: UseInboxFlowResult;
}

export function InboxPanel({ inbox }: InboxPanelProps) {
  const {
    inboxPages,
    inboxHasMore,
    isLoadingInbox,
    senderUsernames,
    readMessageKeys,
    handleLoadInbox,
    handleOpenMessage,
    getMessageKey,
  } = inbox;

  return (
    <div className={styles.inboxArea}>
      <InboxHeader />
      <div className={styles.messagesContainer}>
        {isLoadingInbox && inboxPages.length === 0 ? (
          <p className={styles.loading} role="status" aria-live="polite">
            <Icon name="loading" size="md" decorative className={styles.loadingIcon} />
            Loading…
          </p>
        ) : inboxPages.length === 0 ? (
          <p className={styles.empty}>
            <Icon name="message" size="md" decorative className={styles.emptyIcon} />
            Inbox is quiet. Send the first uncensorable message.
          </p>
        ) : (
          <ul className={styles.list}>
            {inboxPages.map((msg, i) => (
              <InboxListItem
                key={i}
                msg={msg}
                senderName={senderUsernames.get(msg.sender.toLowerCase()) ?? null}
                isUnread={!readMessageKeys.has(getMessageKey(msg))}
                onClick={() => void handleOpenMessage(msg)}
                getMessageKey={getMessageKey}
              />
            ))}
          </ul>
        )}
        {inboxHasMore && (
          <Button
            variant="ghost"
            size="md"
            className={styles.loadMore}
            onClick={() => void handleLoadInbox(true)}
            disabled={isLoadingInbox}
            startIcon={isLoadingInbox ? "loading" : "inbox"}
            data-testid="inbox-load-more"
          >
            {isLoadingInbox ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}
