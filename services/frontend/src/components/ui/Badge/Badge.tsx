import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "default" | "success" | "error" | "unread";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  "data-testid"?: string;
}

export function Badge({
  variant = "default",
  children,
  "data-testid": dataTestId,
}: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[variant]}`}
      data-testid={dataTestId}
    >
      {children}
    </span>
  );
}
