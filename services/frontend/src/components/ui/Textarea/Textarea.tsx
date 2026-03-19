import type { TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  id?: string;
  "data-testid"?: string;
}

export function Textarea({
  label,
  id,
  className = "",
  "data-testid": dataTestId,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name;
  const textarea = (
    <textarea
      id={textareaId}
      className={`${styles.textarea} ${className}`.trim()}
      data-testid={dataTestId}
      {...props}
    />
  );

  if (label) {
    return (
      <div className={styles.wrapper}>
        <label className={styles.label} htmlFor={textareaId}>
          {label}
        </label>
        {textarea}
      </div>
    );
  }

  return textarea;
}
