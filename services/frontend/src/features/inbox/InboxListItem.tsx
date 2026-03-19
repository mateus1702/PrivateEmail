/**
 * Single inbox row: sender, time, unread badge; keyboard-accessible.
 */

import type { Message } from "../../lib/contracts";
import { Badge, Icon } from "../../components/ui";
import styles from "./InboxPanel.module.css";

export interface InboxListItemProps {
  msg: Message;
  senderName: string | null;
  isUnread: boolean;
  onClick: () => void;
  getMessageKey: (m: Message) => string;
}

export function InboxListItem({
  msg,
  senderName,
  isUnread,
  onClick,
  getMessageKey,
}: InboxListItemProps) {
  return (
    <li
      className={styles.item}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`inbox-item-${getMessageKey(msg)}`}
    >
      {isUnread && (
        <span className={styles.badgeWrapper}>
          <Badge variant="unread" data-testid="inbox-badge-unread">
            <Icon name="unread" size="sm" decorative />
            <span>Unread</span>
          </Badge>
        </span>
      )}
      <span className={styles.sender}>From: {senderName ?? "Unknown"}</span>
      <span className={styles.meta}>
        <span className={styles.time}>{new Date(Number(msg.timestamp) * 1000).toLocaleString()}</span>
      </span>
    </li>
  );
}
