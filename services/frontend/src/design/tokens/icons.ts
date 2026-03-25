/**
 * Icon sizing tokens (pixels). Mirrors CSS vars in design/theme.css.
 */
export const ICON_SIZES_PX = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export type IconSizeToken = keyof typeof ICON_SIZES_PX;
