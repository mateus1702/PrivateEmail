import { Icon } from "../../icons";
import styles from "./GlobalLoadingOverlay.module.css";

export interface GlobalLoadingOverlayProps {
  visible: boolean;
}

export function GlobalLoadingOverlay({ visible }: GlobalLoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="global-loading-overlay"
    >
      <span className={styles.srOnly}>Loading</span>
      <div className={styles.panel}>
        <Icon name="loading" size="lg" decorative className={styles.spinner} />
      </div>
    </div>
  );
}
