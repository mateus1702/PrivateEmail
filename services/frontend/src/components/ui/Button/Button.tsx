import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { IconName } from "../../icons/iconTypes";
import { Icon } from "../../icons";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

function iconSizeForButton(buttonSize: ButtonSize): "sm" | "md" {
  return buttonSize === "lg" ? "md" : "sm";
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  /** Use in modal context for light-surface styling */
  modalContext?: boolean;
  /** Leading icon from the app icon registry */
  startIcon?: IconName;
  /** Trailing icon from the app icon registry */
  endIcon?: IconName;
  "data-testid"?: string;
}

export function Button({
  variant = "secondary",
  size = "md",
  children,
  modalContext = false,
  startIcon,
  endIcon,
  className = "",
  "data-testid": dataTestId,
  ...props
}: ButtonProps) {
  const variantClass =
    modalContext && variant === "ghost"
      ? styles.modalGhost
      : modalContext && variant === "primary"
        ? styles.modalPrimary
        : styles[variant];
  const classNames = [
    styles.button,
    styles[size],
    variantClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const is = iconSizeForButton(size);

  return (
    <button
      type="button"
      className={classNames}
      data-testid={dataTestId}
      {...props}
    >
      {startIcon ? <Icon name={startIcon} size={is} decorative /> : null}
      {children}
      {endIcon ? <Icon name={endIcon} size={is} decorative /> : null}
    </button>
  );
}
