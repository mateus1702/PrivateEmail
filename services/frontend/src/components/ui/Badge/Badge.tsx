import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "default" | "success" | "error" | "unread";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  id?: string;
  "data-testid"?: string;
}

export function Badge({
  variant = "default",
  children,
  id,
  "data-testid": dataTestId,
}: BadgeProps) {
  return (
    <span
      id={id}
      className={`${styles.badge} ${styles[variant]}`}
      data-testid={dataTestId}
    >
      {children}
    </span>
  );
}
