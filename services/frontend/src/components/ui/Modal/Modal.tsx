import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import type { IconName } from "../../icons/iconTypes";
import { Icon } from "../../icons";
import styles from "./Modal.module.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** If true, clicking overlay closes modal */
  closeOnOverlayClick?: boolean;
  /** If true, ESC closes modal (default true) */
  closeOnEscape?: boolean;
  /** Element to return focus to on close */
  triggerRef?: React.RefObject<HTMLElement | null>;
  "data-testid"?: string;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  triggerRef,
  "data-testid": dataTestId,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!closeOnEscape || e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const triggerEl = triggerRef?.current ?? null;

    const focusTrap = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || !e.target) return;
      if (dialog.contains(e.target as Node)) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      if (e.target === document.body && first) first.focus();
    };

    document.addEventListener("focusin", focusTrap);
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      FOCUSABLE
    );
    const firstFocusable = focusable?.[0];
    if (firstFocusable) firstFocusable.focus();

    return () => {
      document.removeEventListener("focusin", focusTrap);
      if (triggerEl) {
        triggerEl.focus();
      } else if (previouslyFocused?.focus) {
        previouslyFocused.focus();
      }
    };
  }, [open, triggerRef]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={closeOnOverlayClick ? onClose : undefined}
      onKeyDown={handleKeyDown}
      data-testid={dataTestId ? `${dataTestId}-overlay` : undefined}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        data-testid={dataTestId}
      >
        {children}
      </div>
    </div>
  );
}

export interface ModalHeaderProps {
  children: ReactNode;
  onClose?: () => void;
  /** Optional leading icon for modal context (compose, message, warning, etc.) */
  titleIcon?: IconName;
  /** Extra class for long titles (e.g. cost modal). */
  titleClassName?: string;
}

export function ModalHeader({ children, onClose, titleIcon, titleClassName }: ModalHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        {titleIcon ? (
          <Icon
            name={titleIcon}
            size="md"
            decorative
            className={styles.titleIcon}
            tone={
              titleIcon === "warning"
                ? "warning"
                : titleIcon === "error"
                  ? "error"
                  : "default"
            }
          />
        ) : null}
        <h2
          id="modal-title"
          className={[styles.title, titleClassName].filter(Boolean).join(" ")}
        >
          {children}
        </h2>
      </div>
      {onClose && (
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" size="md" decorative />
        </button>
      )}
    </div>
  );
}

export interface ModalBodyProps {
  children: ReactNode;
}

export function ModalBody({ children }: ModalBodyProps) {
  return <div className={styles.body}>{children}</div>;
}

export interface ModalFooterProps {
  children: ReactNode;
}

export function ModalFooter({ children }: ModalFooterProps) {
  return <div className={styles.footer}>{children}</div>;
}
