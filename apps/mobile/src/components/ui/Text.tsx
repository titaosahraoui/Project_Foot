import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors, typography } from "@footconnect/ui";
import { fontFamily } from "../../theme/fonts";

export type TextVariant =
  | "displayL"
  | "displayM"
  | "titleL"
  | "titleM"
  | "titleS"
  | "bodyL"
  | "body"
  | "bodySmall"
  | "caption"
  | "overline"
  | "stat"
  | "statLg";

const ls = (em: number, size: number) => em * size;

const VARIANTS: Record<TextVariant, TextStyle> = {
  displayL: {
    fontFamily: fontFamily.display,
    fontSize: typography.size.displayL,
    letterSpacing: ls(typography.letterSpacingEm.tighter, typography.size.displayL),
    lineHeight: typography.size.displayL * typography.lineHeight.tight,
    color: colors.textPrimary,
  },
  displayM: {
    fontFamily: fontFamily.display,
    fontSize: typography.size.displayM,
    letterSpacing: ls(typography.letterSpacingEm.tight, typography.size.displayM),
    lineHeight: typography.size.displayM * typography.lineHeight.snug,
    color: colors.textPrimary,
  },
  titleL: {
    fontFamily: fontFamily.display,
    fontSize: typography.size.titleL,
    letterSpacing: ls(typography.letterSpacingEm.tight, typography.size.titleL),
    color: colors.textPrimary,
  },
  titleM: {
    fontFamily: fontFamily.sansBold,
    fontSize: typography.size.titleM,
    color: colors.textPrimary,
  },
  titleS: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: typography.size.titleS,
    color: colors.textPrimary,
  },
  bodyL: { fontFamily: fontFamily.sans, fontSize: typography.size.bodyL, color: colors.textPrimary, lineHeight: typography.size.bodyL * typography.lineHeight.normal },
  body: { fontFamily: fontFamily.sans, fontSize: typography.size.bodyM, color: colors.textPrimary, lineHeight: typography.size.bodyM * typography.lineHeight.normal },
  bodySmall: { fontFamily: fontFamily.sans, fontSize: typography.size.bodyS, color: colors.textSecondary },
  caption: { fontFamily: fontFamily.sans, fontSize: typography.size.caption, color: colors.textMuted },
  overline: {
    fontFamily: fontFamily.condensedBold,
    fontSize: typography.size.micro,
    letterSpacing: ls(typography.letterSpacingEm.overline, typography.size.micro),
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  stat: {
    fontFamily: fontFamily.condensedBold,
    fontSize: typography.size.titleM,
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  statLg: {
    fontFamily: fontFamily.condensedBold,
    fontSize: typography.size.displayM,
    fontVariant: ["tabular-nums"],
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
