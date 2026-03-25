import type { ComponentType, SVGProps } from "react";
import type { IconName } from "./iconTypes";
import {
  GlyphClose,
  GlyphRefresh,
  GlyphSend,
  GlyphCopy,
  GlyphLogout,
  GlyphCompose,
  GlyphInbox,
  GlyphMessage,
  GlyphUnread,
  GlyphSuccess,
  GlyphError,
  GlyphWarning,
  GlyphLoading,
  GlyphWallet,
  GlyphChevronLeft,
  GlyphGithub,
} from "./glyphs";
import styles from "./Icon.module.css";

export type IconSize = "sm" | "md" | "lg";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "size"> {
  name: IconName;
  size?: IconSize;
  /** When true (default), icon is hidden from assistive tech (pair with visible label). */
  decorative?: boolean;
  /** Required when decorative is false (standalone meaningful icon). */
  "aria-label"?: string;
  /** Apply semantic color for state icons (success | error | warning). */
  tone?: "default" | "success" | "error" | "warning";
  className?: string;
  "data-testid"?: string;
}

const GLYPHS: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  wallet: GlyphWallet,
  close: GlyphClose,
  refresh: GlyphRefresh,
  send: GlyphSend,
  copy: GlyphCopy,
  logout: GlyphLogout,
  compose: GlyphCompose,
  inbox: GlyphInbox,
  message: GlyphMessage,
  unread: GlyphUnread,
  success: GlyphSuccess,
  error: GlyphError,
  warning: GlyphWarning,
  loading: GlyphLoading,
  chevronLeft: GlyphChevronLeft,
  github: GlyphGithub,
};

export function Icon({
  name,
  size = "md",
  decorative = true,
  tone = "default",
  className = "",
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
  ...svgProps
}: IconProps) {
  const Glyph = GLYPHS[name];
  const toneClass =
    tone === "success"
      ? styles.successTone
      : tone === "error"
        ? styles.errorTone
        : tone === "warning"
          ? styles.warningTone
          : "";

  const wrapperClass = [
    styles.wrapper,
    styles[size],
    name === "loading" ? styles.spin : "",
    toneClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={wrapperClass}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : ariaLabel}
      data-testid={dataTestId}
    >
      <Glyph
        aria-hidden
        focusable={false}
        {...svgProps}
      />
    </span>
  );
}
