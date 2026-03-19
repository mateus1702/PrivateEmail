import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  "data-testid"?: string;
}

export function Card({
  children,
  elevated = false,
  className = "",
  "data-testid": dataTestId,
  ...props
}: CardProps) {
  const classNames = [
    styles.card,
    elevated ? styles.cardElevated : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} data-testid={dataTestId} {...props}>
      {children}
    </div>
  );
}
