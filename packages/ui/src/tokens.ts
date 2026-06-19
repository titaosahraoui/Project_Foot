/**
 * Placeholder design tokens for FootConnect.
 * These are refined when the `FootConnect App.dc.html` design is pulled
 * via the Claude Design connector. Treat values as provisional.
 */

export const colors = {
  primary: "#16a34a",
  primaryDark: "#15803d",
  background: "#0b0f0d",
  surface: "#14181a",
  text: "#f5f7f6",
  textMuted: "#9aa6a0",
  border: "#222a27",
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#22c55e",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const typography = {
  fontFamily: "System",
  sizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  weights: { regular: "400", medium: "500", bold: "700" },
} as const;

export const tokens = { colors, spacing, radii, typography } as const;
export type Tokens = typeof tokens;
