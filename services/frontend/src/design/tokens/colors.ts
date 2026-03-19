/**
 * Semantic color tokens for the design system.
 * Use CSS variables in theme.css; these TS values are for reference and tooling.
 */
export const colors = {
  /** Background surfaces */
  bgBase: "#0b1220",
  bgSurface: "#0f172a",
  bgSurfaceElevated: "#1e293b",
  bgOverlay: "rgba(2, 6, 23, 0.72)",
  bgModal: "rgba(248, 250, 252, 0.98)",
  bgInput: "#ffffff",
  bgCard: "rgba(255, 255, 255, 0.94)",

  /** Text */
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textOnPrimary: "#ffffff",
  textOnDark: "#e2e8f0",

  /** Borders */
  borderMuted: "rgba(148, 163, 184, 0.2)",
  borderDefault: "rgba(148, 163, 184, 0.25)",
  borderStrong: "rgba(148, 163, 184, 0.4)",
  borderInput: "#cbd5e1",

  /** Brand / accent */
  accentPrimary: "#4f46e5",
  accentSecondary: "#0ea5e9",
  accentMuted: "rgba(99, 102, 241, 0.22)",

  /** Semantic */
  success: "#10b981",
  successBg: "#065f46",
  error: "#ef4444",
  errorBg: "#7f1d1d",
  warning: "#f59e0b",
  info: "#3b82f6",

  /** Interactive states */
  interactiveHover: "rgba(148, 163, 184, 0.2)",
  interactiveActive: "rgba(148, 163, 184, 0.12)",
  focusRing: "rgba(99, 102, 241, 0.16)",
} as const;

export type ColorToken = keyof typeof colors;
