import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radii, shadows, spacing } from "@footconnect/ui";
import { Text } from "./Text";
import { fontFamily } from "../../theme/fonts";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "elite";
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { height: number; px: number; fontSize: number }> = {
  sm: { height: 38, px: spacing.sm, fontSize: 13 },
  md: { height: 48, px: spacing.md, fontSize: 16 },
  lg: { height: 56, px: spacing.lg, fontSize: 18 },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  glow?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = true,
  glow = false,
  style,
  icon,
}: ButtonProps) {
  const s = SIZE[size];
  const isDisabled = disabled || loading;

  const labelColor =
    variant === "primary"
      ? colors.onPrimary
      : variant === "danger"
        ? colors.loss
        : variant === "secondary"
          ? colors.textPrimary
          : colors.primary;

  const inner = loading ? (
    <ActivityIndicator color={labelColor} />
  ) : (
    <>
      {icon}
      <Text
        style={{
          fontFamily: fontFamily.headline,
          fontSize: s.fontSize,
          color: labelColor,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </>
  );

  const base: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.px,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    opacity: isDisabled ? 0.5 : 1,
    alignSelf: fullWidth ? "stretch" : "flex-start",
  };

  if (variant === "primary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          { transform: [{ scale: pressed ? 0.97 : 1 }] },
          fullWidth && { alignSelf: "stretch" },
          glow && shadows.glowNeon,
          style,
        ]}
      >
        <LinearGradient
          colors={gradients.brand as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[base, { backgroundColor: colors.primaryContainer }]}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  const variantStyle: ViewStyle =
    variant === "secondary"
      ? { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.borderDefault }
      : variant === "danger"
        ? { backgroundColor: colors.lossBg, borderWidth: 1, borderColor: colors.loss }
        : { backgroundColor: "transparent" };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [base, variantStyle, { transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}
    >
      {inner}
    </Pressable>
  );
}

export const buttonStyles = StyleSheet.create({ row: { flexDirection: "row", gap: spacing.sm } });
