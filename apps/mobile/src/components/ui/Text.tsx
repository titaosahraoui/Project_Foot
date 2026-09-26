import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors, typography } from "@footconnect/ui";
import { fontFamily } from "../../theme/fonts";

export type TextVariant =
  | "displayLg"
  | "headlineLg"
  | "headlineLgMobile"
  | "headlineMd"
  | "statsXl"
  | "statsMd"
  | "bodyLg"
  | "bodyMd"
  | "bodySm"
  | "labelSm"
  | "labelXs"
  | "displayL"
  | "displayM"
  | "titleL"
  | "titleM"
  | "titleS"
  | "body"
  | "bodySmall"
  | "caption"
  | "overline"
  | "stat"
  | "statLg";

const ls = (em: number, size: number) => em * size;

const VARIANTS: Record<TextVariant, TextStyle> = {
  // ---- Pitch Dark Kinetic Stitch Scale ----
  displayLg: {
    fontFamily: fontFamily.display,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -0.02 * 48,
    color: colors.textPrimary,
  },
  headlineLg: {
    fontFamily: fontFamily.headline,
    fontSize: 32,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  headlineLgMobile: {
    fontFamily: fontFamily.headline,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.01 * 28,
    color: colors.textPrimary,
  },
  headlineMd: {
    fontFamily: fontFamily.headline,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  statsXl: {
    fontFamily: fontFamily.stats,
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -0.05 * 24,
    color: colors.textPrimary,
  },
  statsMd: {
    fontFamily: fontFamily.stats,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.03 * 16,
    color: colors.textPrimary,
  },
  bodyLg: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  bodyMd: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodySm: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  labelSm: {
    fontFamily: fontFamily.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.05 * 12,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  labelXs: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.08 * 10,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },

  // ---- Legacy Aliases ----
  displayL: {
    fontFamily: fontFamily.display,
    fontSize: typography.size.displayL,
    letterSpacing: ls(-0.03, typography.size.displayL),
    lineHeight: typography.size.displayL * 1.05,
    color: colors.textPrimary,
  },
  displayM: {
    fontFamily: fontFamily.display,
    fontSize: typography.size.displayM,
    letterSpacing: ls(-0.02, typography.size.displayM),
    lineHeight: typography.size.displayM * 1.15,
    color: colors.textPrimary,
  },
  titleL: {
    fontFamily: fontFamily.display,
    fontSize: typography.size.titleL,
    letterSpacing: ls(-0.015, typography.size.titleL),
    color: colors.textPrimary,
  },
  titleM: {
    fontFamily: fontFamily.headline,
    fontSize: typography.size.titleM,
    color: colors.textPrimary,
  },
  titleS: {
    fontFamily: fontFamily.headlineSemi,
    fontSize: typography.size.titleS,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: typography.size.bodyL,
    color: colors.textPrimary,
    lineHeight: typography.size.bodyL * 1.45,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: typography.size.bodyM,
    color: colors.textSecondary,
    lineHeight: typography.size.bodyM * 1.4,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: typography.size.caption,
    color: colors.textMuted,
  },
  overline: {
    fontFamily: fontFamily.headline,
    fontSize: typography.size.caption,
    letterSpacing: ls(0.12, typography.size.caption),
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  stat: {
    fontFamily: fontFamily.stats,
    fontSize: typography.size.titleM,
    color: colors.textPrimary,
  },
  statLg: {
    fontFamily: fontFamily.stats,
    fontSize: typography.size.displayM,
    color: colors.textPrimary,
  },
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

export function Text({ variant = "body", color, style, ...rest }: AppTextProps) {
  return <RNText {...rest} style={[VARIANTS[variant], color ? { color } : null, style]} />;
}
