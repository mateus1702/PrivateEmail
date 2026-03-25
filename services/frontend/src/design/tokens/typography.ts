/**
 * Typography tokens for the design system.
 */
export const fontFamily = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  mono: "'Fira Code', 'Monaco', 'Consolas', 'Roboto Mono', monospace",
} as const;

export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.5rem",
  "4xl": "2rem",
  "5xl": "2.5rem",
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const lineHeight = {
  tight: "1.1",
  snug: "1.2",
  normal: "1.5",
  relaxed: "1.6",
} as const;
