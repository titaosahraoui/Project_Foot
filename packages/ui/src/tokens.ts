/**
 * FootConnect design tokens — "pitch at night".
 * Mirrored from the claude.ai/design system (footconnect-design-system-c8e82ee5).
 * Plain cross-platform values (no react-native import) so web + mobile can share them.
 */

export const colors = {
  // ---- Ramps ----
  green50: "#E8FFF4",
  green100: "#C3FFE0",
  green200: "#8DFFC4",
  green300: "#4CFFA1",
  green400: "#1CF785",
  green500: "#00E676",
  green600: "#00C264",
  green700: "#009A50",
  green800: "#06703D",
  teal300: "#7BF4D8",
  teal400: "#36E7C0",
  teal500: "#1DE9B6",
  teal600: "#11B594",
  ink0: "#05070A",
  ink1: "#0A0E12",
  ink2: "#11161C",
  ink3: "#182027",
  ink4: "#222C35",
  ink5: "#2E3A45",
  ink6: "#3C4A57",
  mist1: "#6B7A82",
  mist2: "#8A99A1",
  mist3: "#A8B6BC",
  mist4: "#CDD8DC",
  paper: "#E8FFF4",

  // ---- Semantic surfaces ----
  bgBase: "#0A0E12",
  bgSunken: "#05070A",
  surface1: "#11161C",
  surface2: "#182027",
  surface3: "#222C35",
  surfaceInset: "#0C1116",

  // ---- Borders ----
  borderSubtle: "rgba(232, 255, 244, 0.07)",
  borderDefault: "rgba(232, 255, 244, 0.12)",
  borderStrong: "rgba(232, 255, 244, 0.20)",
  borderGreen: "rgba(0, 230, 118, 0.45)",

  // ---- Text ----
  textPrimary: "#E8FFF4",
  textSecondary: "#A8B6BC",
  textOnGreen: "#04130B",
  textLink: "#1CF785",

  // ---- Brand ----
  brand: "#00E676",
  brandHover: "#1CF785",
  brandPress: "#00C264",
  accent: "#1DE9B6",

  // ---- Match semantics ----
  win: "#00E676",
  winBg: "rgba(0, 230, 118, 0.12)",
  loss: "#FF4D5E",
  lossBg: "rgba(255, 77, 94, 0.12)",
  draw: "#FFB200",
  drawBg: "rgba(255, 178, 0, 0.12)",

  // ---- Status ----
  success: "#00E676",
  warning: "#FFB200",
  danger: "#FF4D5E",
  info: "#34B7FF",

  // ---- Back-compat aliases (used by earlier screens) ----
  primary: "#00E676",
  primaryDark: "#00C264",
  background: "#0A0E12",
  surface: "#11161C",
  text: "#E8FFF4",
  textMuted: "#6B7A82",
  border: "rgba(232, 255, 244, 0.12)",
} as const;

/** Gradient color stops (apply direction in the component via expo-linear-gradient). */
export const gradients = {
  brand: ["#00E676", "#1DE9B6"],
  hero: ["#14241D", "#0A0E12"],
  pitch: ["#0F1A16", "#0A0E12"],
  greenFade: ["rgba(0,230,118,0.16)", "rgba(0,230,118,0)"],
} as const;

export type TierName = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "elite";

export const tiers: Record<TierName, { base: string; light: string; dark: string; grad: string[] }> = {
  bronze: { base: "#C97B3C", light: "#ECAE73", dark: "#7E4A20", grad: ["#ECAE73", "#C97B3C", "#7E4A20"] },
  silver: { base: "#BFC9D4", light: "#EEF3F8", dark: "#7E8A97", grad: ["#EEF3F8", "#BFC9D4", "#7E8A97"] },
  gold: { base: "#F5C84B", light: "#FFE89B", dark: "#B8862A", grad: ["#FFE89B", "#F5C84B", "#B8862A"] },
  platinum: { base: "#57E0C6", light: "#B6F6EA", dark: "#1E9C86", grad: ["#B6F6EA", "#57E0C6", "#1E9C86"] },
  diamond: { base: "#8FB8FF", light: "#D6E5FF", dark: "#4F73C4", grad: ["#D6E5FF", "#8FB8FF", "#4F73C4"] },
  elite: { base: "#C77DFF", light: "#EBCBFF", dark: "#7B3FB5", grad: ["#EBCBFF", "#C77DFF", "#7B3FB5"] },
};

export const typography = {
  /** Font-family keys; the mobile app maps these to loaded Archivo fonts (see fonts.ts). */
  family: {
    display: "ArchivoExpanded",
    sans: "Archivo",
    condensed: "ArchivoNarrow",
  },
  size: {
    displayXl: 64,
    displayL: 48,
    displayM: 36,
    titleL: 28,
    titleM: 22,
    titleS: 18,
    bodyL: 17,
    bodyM: 15,
    bodyS: 13,
    caption: 12,
    micro: 11,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
  },
  lineHeight: { tight: 1.02, snug: 1.15, normal: 1.45, relaxed: 1.6 },
  /** Letter spacing as em multipliers (multiply by font size for RN's absolute px). */
  letterSpacingEm: { tighter: -0.03, tight: -0.015, normal: 0, wide: 0.04, wider: 0.08, overline: 0.16 },
} as const;

export const spacing = {
  // back-compat named scale
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // layout
  gutter: 20,
  headerH: 56,
  tabbarH: 72,
  appWidth: 400,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
  pill: 999,
  full: 9999,
} as const;

/** React-Native-ready elevation/glow presets. */
export const shadows = {
  card: { shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6 },
  raised: { shadowColor: "#000000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 12 },
  glowGreen: { shadowColor: "#00E676", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
} as const;

export const motion = { fast: 120, base: 200, slow: 360 } as const;

export const theme = { colors, gradients, tiers, typography, spacing, radii, shadows, motion } as const;
export type Theme = typeof theme;

// Legacy aggregate kept for backward compatibility.
export const tokens = { colors, spacing, radii, typography } as const;
