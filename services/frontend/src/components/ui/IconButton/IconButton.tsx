import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  children: ReactNode;
  variant?: "default" | "ghost";
  "data-testid"?: string;
}

export function IconButton({
  "aria-label": ariaLabel,
  children,
  variant = "default",
  className = "",
  "data-testid": dataTestId,
  ...props
}: IconButtonProps) {
  const classNames = [
    styles.iconButton,
    variant === "ghost" ? styles.ghost : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classNames}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      {...props}
    >
      {children}
    </button>
  );
}
