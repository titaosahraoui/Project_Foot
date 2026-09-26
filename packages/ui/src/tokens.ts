/**
 * FootConnect design tokens — "Pitch Dark Kinetic" (Stadium-at-Night).
 * Extracted from Stitch MCP: FootConnect Arena Infrastructure (project 17220594494476272576).
 * Plain cross-platform values so Web and Mobile can share them cleanly.
 */

export const colors = {
  // ---- Pitch Dark Kinetic Surfaces (Stadium-at-Night) ----
  layer0: "#0A0F0A", // Deep dark pitch black
  layer1: "#141C14", // Surface card background with floodlight moss tint
  bgBase: "#0A0F0A",
  bgSunken: "#05070A",
  surface: "#111412",
  surfaceDim: "#111412",
  surfaceBright: "#373a38",
  surfaceContainerLowest: "#0c0f0d",
  surfaceContainerLow: "#191c1a",
  surfaceContainer: "#1d201e",
  surfaceContainerHigh: "#272b29",
  surfaceContainerHighest: "#323633",
  surfaceVariant: "#323633",
  surfaceTint: "#abd600",

  // Legacy surface ramps for backward compatibility
  surface1: "#141C14",
  surface2: "#1d201e",
  surface3: "#272b29",
  surfaceInset: "#0c0f0d",

  // ---- Text & On-Surface ----
  onSurface: "#e1e3e0",
  onSurfaceVariant: "#c4c9ac",
  onBackground: "#e1e3e0",
  inverseSurface: "#e1e3e0",
  inverseOnSurface: "#2e312f",
  textPrimary: "#e1e3e0",
  textSecondary: "#c4c9ac",
  textMuted: "#8e9379",
  textOnGreen: "#00210e",
  textOnLime: "#161e00",
  textLink: "#c3f400",
  paper: "#e1e3e0",

  // ---- Primary Brand (Neon Pitch Lime / Floodlight) ----
  primary: "#ffffff",
  onPrimary: "#283500",
  primaryContainer: "#c3f400",
  onPrimaryContainer: "#556d00",
  primaryFixed: "#c3f400",
  primaryFixedDim: "#abd600",
  onPrimaryFixed: "#161e00",
  onPrimaryFixedVariant: "#3c4d00",
  inversePrimary: "#506600",
  brand: "#c3f400",
  brandHover: "#d4ff33",
  brandPress: "#abd600",

  // ---- Secondary (Elo Green / Growth & Trust) ----
  secondary: "#e9ffeb",
  onSecondary: "#00391d",
  secondaryContainer: "#00fd93",
  onSecondaryContainer: "#00703e",
  secondaryFixed: "#5affa2",
  secondaryFixedDim: "#00e384",
  onSecondaryFixed: "#00210e",
  onSecondaryFixedVariant: "#00522c",
  accent: "#00fd93",

  // ---- Tertiary & Alerts (Alert Red / Loss & Fouls) ----
  tertiary: "#ffffff",
  onTertiary: "#680008",
  tertiaryContainer: "#ffdad6",
  onTertiaryContainer: "#ca081c",
  tertiaryFixed: "#ffdad6",
  tertiaryFixedDim: "#ffb3ac",
  onTertiaryFixed: "#410003",
  onTertiaryFixedVariant: "#930010",
  error: "#ffb4ab",
  onError: "#690005",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",

  // ---- Match & Status Semantics ----
  win: "#00fd93",
  winBg: "rgba(0, 253, 147, 0.12)",
  loss: "#ff3b3b",
  lossBg: "rgba(255, 59, 59, 0.12)",
  draw: "#ffb200",
  drawBg: "rgba(255, 178, 0, 0.12)",
  success: "#00fd93",
  warning: "#ffb200",
  danger: "#ff3b3b",
  info: "#34b7ff",

  // ---- Outlines & Borders ----
  outline: "#8e9379",
  outlineVariant: "#444933",
  borderSubtle: "rgba(255, 255, 255, 0.07)",
  borderDefault: "rgba(255, 255, 255, 0.12)",
  borderStrong: "rgba(255, 255, 255, 0.20)",
  borderGreen: "rgba(195, 244, 0, 0.45)",

  // ---- Back-compat aliases ----
  primaryDark: "#abd600",
  background: "#0A0F0A",
  text: "#e1e3e0",
  border: "rgba(255, 255, 255, 0.12)",
} as const;

/** Gradient color stops */
export const gradients = {
  brand: ["#c3f400", "#00fd93"] as const,
  hero: ["#141C14", "#0A0F0A"] as const,
  pitch: ["#192319", "#0A0F0A"] as const,
  limeFade: ["rgba(195, 244, 0, 0.25)", "rgba(195, 244, 0, 0)"] as const,
  greenFade: ["rgba(0, 253, 147, 0.20)", "rgba(0, 253, 147, 0)"] as const,
  holographicElite: ["#c3f400", "#00fd93", "#38bdf8"] as const,
} as const;

export type TierName = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "elite";

export const tiers: Record<TierName, { base: string; light: string; dark: string; grad: readonly string[] }> = {
  bronze: { base: "#CD7F32", light: "#ECAE73", dark: "#7E4A20", grad: ["#ECAE73", "#CD7F32", "#7E4A20"] },
  silver: { base: "#C0C0C0", light: "#EEF3F8", dark: "#7E8A97", grad: ["#EEF3F8", "#C0C0C0", "#7E8A97"] },
  gold: { base: "#FFD700", light: "#FFE89B", dark: "#B8862A", grad: ["#FFE89B", "#FFD700", "#B8862A"] },
  platinum: { base: "#57E0C6", light: "#B6F6EA", dark: "#1E9C86", grad: ["#B6F6EA", "#57E0C6", "#1E9C86"] },
  diamond: { base: "#8FB8FF", light: "#D6E5FF", dark: "#4F73C4", grad: ["#D6E5FF", "#8FB8FF", "#4F73C4"] },
  elite: { base: "#c3f400", light: "#e9ffeb", dark: "#00703e", grad: ["#c3f400", "#00fd93", "#38bdf8"] },
};

export const typography = {
  /** Triple-font hierarchy from Stitch */
  family: {
    display: "BarlowCondensed_800ExtraBold",
    headline: "BarlowCondensed_700Bold",
    headlineCondensed: "BarlowCondensed_700Bold",
    body: "Inter_400Regular",
    bodyMedium: "Inter_500Medium",
    bodySemiBold: "Inter_600SemiBold",
    bodyBold: "Inter_700Bold",
    stats: "JetBrainsMono_700Bold",
    statsRegular: "JetBrainsMono_400Regular",
    // Fallback/Legacy aliases
    sans: "Inter_400Regular",
    condensed: "BarlowCondensed_700Bold",
  },
  /** Type scale from Stitch designMd & theme */
  scale: {
    displayLg: { fontSize: 48, lineHeight: 52, letterSpacing: -0.02 * 48, fontWeight: "800" as const },
    headlineLg: { fontSize: 32, lineHeight: 36, letterSpacing: 0, fontWeight: "700" as const },
    headlineLgMobile: { fontSize: 28, lineHeight: 32, letterSpacing: -0.01 * 28, fontWeight: "700" as const },
    headlineMd: { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: "700" as const },
    statsXl: { fontSize: 24, lineHeight: 24, letterSpacing: -0.05 * 24, fontWeight: "700" as const },
    statsMd: { fontSize: 16, lineHeight: 20, letterSpacing: -0.03 * 16, fontWeight: "700" as const },
    statsSm: { fontSize: 13, lineHeight: 16, letterSpacing: 0, fontWeight: "700" as const },
    bodyLg: { fontSize: 18, lineHeight: 26, letterSpacing: 0, fontWeight: "400" as const },
    bodyMd: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontWeight: "400" as const },
    bodySm: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: "400" as const },
    labelSm: { fontSize: 12, lineHeight: 16, letterSpacing: 0.05 * 12, fontWeight: "600" as const },
    labelXs: { fontSize: 10, lineHeight: 14, letterSpacing: 0.08 * 10, fontWeight: "700" as const },
  },
  // Legacy size numbers for compatibility
  size: {
    displayXl: 64,
    displayL: 48,
    displayM: 36,
    titleL: 32,
    titleM: 28,
    titleS: 22,
    bodyL: 16,
    bodyM: 14,
    bodyS: 12,
    caption: 11,
    micro: 10,
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
  letterSpacingEm: { tighter: -0.03, tight: -0.015, normal: 0, wide: 0.04, wider: 0.08, overline: 0.16 },
} as const;

export const spacing = {
  base: 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 40,
  xl: 64,
  xxl: 48,
  gutter: 16,
  marginMobile: 16,
  marginDesktop: 48,
  // Layout helpers
  headerH: 56,
  tabbarH: 72,
  appWidth: 400,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  default: 4,
  md: 10,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
  full: 9999,
} as const;

/** React-Native-ready shadows and luminescent glows */
export const shadows = {
  card: { shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 6 },
  raised: { shadowColor: "#000000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.75, shadowRadius: 28, elevation: 12 },
  glowNeon: { shadowColor: "#c3f400", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 15, elevation: 8 },
  glowSubtle: { shadowColor: "#c3f400", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  glowGreen: { shadowColor: "#00fd93", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 },
  glowRed: { shadowColor: "#ff3b3b", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 },
} as const;

export const motion = { fast: 120, base: 200, slow: 360 } as const;

export const theme = { colors, gradients, tiers, typography, spacing, radii, shadows, motion } as const;
export type Theme = typeof theme;

// Aggregate tokens
export const tokens = { colors, gradients, tiers, typography, spacing, radii, shadows, motion } as const;
