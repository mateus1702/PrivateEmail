import type { ReactNode } from "react";
import styles from "./AuthShell.module.css";

export interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className={styles.authShell}>
      <div className={styles.grid}>{children}</div>
    </div>
  );
}
