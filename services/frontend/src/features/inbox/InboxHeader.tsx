/**
 * Inbox list intro: title and helper copy.
 */

import { Icon } from "../../components/ui";
import styles from "./InboxPanel.module.css";

export function InboxHeader() {
  return (
    <div className={styles.intro}>
      <h2 className={styles.introHeading}>
        <Icon name="inbox" size="md" decorative className={styles.introHeadingIcon} />
        Your Inbox
      </h2>
      <p>Private, encrypted conversations. Click any message to decrypt and read.</p>
    </div>
  );
}
