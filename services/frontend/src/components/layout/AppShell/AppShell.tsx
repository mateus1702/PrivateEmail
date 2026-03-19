import type { HTMLAttributes, ReactNode } from "react";
import styles from "./AppShell.module.css";

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function AppShell({ children, className = "", ...props }: AppShellProps) {
  return (
    <div className={`${styles.shell} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
