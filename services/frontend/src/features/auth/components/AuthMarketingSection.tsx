/**
 * Marketing / hero section on the auth screen (desktop + mobile CTA).
 */

import styles from "../AuthPanel.module.css";

export interface AuthMarketingSectionProps {
  onOpenAuth: () => void;
}

export function AuthMarketingSection({ onOpenAuth }: AuthMarketingSectionProps) {
  return (
    <section className={styles.marketing}>
      <div className={styles.brand}>
        <img src="/logo.svg" alt="Private Mail Logo" className={styles.logo} />
        <span className={styles.brandName}>Private Mail</span>
      </div>
      <p className={styles.eyebrow}>Private messaging built for web3 teams</p>
      <h1 className={styles.title}>Ship encrypted conversations without wallet friction.</h1>
      <p className={styles.subtitle}>
        Private Mail combines end-to-end encrypted delivery, smart-account onboarding, and predictable
        USDC billing so your users can message instantly.
      </p>
      <div className={styles.trustGrid} aria-label="Product highlights">
        <article className={styles.trustItem}>
          <p className={styles.trustLabel}>Security</p>
          <p className={styles.trustValue}>Encrypted payloads, on-chain identity keys.</p>
        </article>
        <article className={styles.trustItem}>
          <p className={styles.trustLabel}>Onboarding</p>
          <p className={styles.trustValue}>Birthday + password credentials, no seed phrase.</p>
        </article>
        <article className={styles.trustItem}>
          <p className={styles.trustLabel}>Billing</p>
          <p className={styles.trustValue}>Gas and service fees confirmed in USDC.</p>
        </article>
      </div>
      <ul className={styles.benefits}>
        <li>Decrypt only after authenticated session recovery on this device.</li>
        <li>Review estimated USDC costs before activation and before each send.</li>
        <li>Scale from solo inboxes to team support and incident response flows.</li>
      </ul>
      <button
        type="button"
        className={styles.ctaButton}
        onClick={onOpenAuth}
        data-testid="auth-open-btn"
      >
        Open Secure Inbox
      </button>
    </section>
  );
}
