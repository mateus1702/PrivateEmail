import type { ReactNode } from "react";
import { Icon } from "../../icons";
import styles from "./Toast.module.css";

export type ToastVariant = "success" | "error";

export interface ToastProps {
  variant: ToastVariant;
  children: ReactNode;
  /** When false, only text is shown (icons are decorative when shown). */
  showIcon?: boolean;
  "data-testid"?: string;
}

export function Toast({
  variant,
  children,
  showIcon = true,
  "data-testid": dataTestId,
}: ToastProps) {
  const role = variant === "error" ? "alert" : "status";
  const iconName = variant === "error" ? "error" : "success";
  return (
    <div
      className={`${styles.toast} ${styles[variant]}`}
      role={role}
      data-testid={dataTestId}
    >
      <span className={styles.inner}>
        {showIcon ? (
          <Icon
            name={iconName}
            size="md"
            decorative
            className={styles.toastIcon}
          />
        ) : null}
        <span className={styles.toastText}>{children}</span>
      </span>
    </div>
  );
}
