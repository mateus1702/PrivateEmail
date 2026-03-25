/**
 * Marketing / hero section on the auth screen (desktop + mobile CTA).
 */

import {
  PRIVATEMAIL_GITHUB_URL,
  PRIVATEMAIL_SOURCE_LINK_LABEL,
} from "../../../lib/privatemailMeta";
import { Icon } from "../../../components/ui";
import styles from "../AuthPanel.module.css";

export interface AuthMarketingSectionProps {
  onOpenAuth: () => void;
}

export function AuthMarketingSection({ onOpenAuth }: AuthMarketingSectionProps) {
  return (
    <section className={styles.marketing}>
      <div className={styles.brandRow}>
        <div className={styles.brand}>
          <img src="/logo.svg" alt="PrivateMail logo" className={styles.logo} />
          <span className={styles.brandName}>PrivateMail</span>
        </div>
        <a
          href={PRIVATEMAIL_GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
          data-testid="auth-github-link"
        >
          <Icon name="github" size="sm" decorative />
          <span className={styles.githubLinkLabel}>{PRIVATEMAIL_SOURCE_LINK_LABEL}</span>
        </a>
      </div>
      <p className={styles.eyebrow}>Decentralized. Encrypted. Yours.</p>
      <h1 className={styles.title}>PrivateMail – Inbox on the Blockchain</h1>
      <p className={styles.subtitle}>
        End-to-end encrypted messages stored immutably on-chain. Powered by ERC-4337 smart accounts. No
        seed phrases. No corporate middleman.
      </p>
      <div className={styles.trustGrid} aria-label="Product highlights">
        <article className={styles.trustItem}>
          <p className={styles.trustValue}>Client-side encryption – never leaves your device</p>
        </article>
        <article className={styles.trustItem}>
          <p className={styles.trustValue}>Gasless sends & receives via sponsored USDC</p>
        </article>
        <article className={styles.trustItem}>
          <p className={styles.trustValue}>Identity from birthday + password only</p>
        </article>
        <article className={styles.trustItem}>
          <p className={styles.trustValue}>Censorship-resistant, forever on-chain</p>
        </article>
      </div>
      <ul className={styles.benefits}>
        <li>Derive your address in seconds – no 24-word seed to lose</li>
        <li>Fund once with USDC for seamless, sponsored transactions</li>
        <li>True ownership: messages are yours, on the blockchain</li>
      </ul>
      <button
        type="button"
        className={styles.ctaButton}
        onClick={onOpenAuth}
        data-testid="auth-open-btn"
      >
        Launch Your Sovereign Inbox
      </button>
    </section>
  );
}
