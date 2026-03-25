/**
 * Spacing scale for consistent layout.
 * Values in rem.
 */
export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
} as const;

/** Layout-specific dimensions */
export const layout = {
  headerHeight: "84px",
  headerHeightMobile: "72px",
  headerHeightMobileSm: "64px",
  footerHeight: "88px",
  footerHeightMobile: "210px",
  footerHeightMobileSm: "230px",
} as const;
