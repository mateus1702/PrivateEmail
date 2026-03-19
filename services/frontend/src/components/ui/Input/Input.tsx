import type { InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id?: string;
  "data-testid"?: string;
}

export function Input({
  label,
  id,
  className = "",
  "data-testid": dataTestId,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const input = (
    <input
      id={inputId}
      className={`${styles.input} ${className}`.trim()}
      data-testid={dataTestId}
      {...props}
    />
  );

  if (label) {
    return (
      <div className={styles.wrapper}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        {input}
      </div>
    );
  }

  return input;
}
