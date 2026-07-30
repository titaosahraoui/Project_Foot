import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radii, spacing } from "@footconnect/ui";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { height: number; px: number; fontSize: number }> = {
  sm: { height: 40, px: spacing.md, fontSize: 14 },
  md: { height: 50, px: spacing.lg, fontSize: 15 },
  lg: { height: 56, px: spacing.lg, fontSize: 16 },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const s = SIZE[size];
  const isDisabled = disabled || loading;

  const labelColor =
    variant === "primary" ? colors.textOnGreen : variant === "danger" ? colors.loss : colors.textPrimary;

  const inner = loading ? (
    <ActivityIndicator color={labelColor} />
  ) : (
    <Text
      style={{
        fontFamily: "Archivo_700Bold",
        fontSize: s.fontSize,
        color: labelColor,
        letterSpacing: 0.2,
      }}
    >
      {label}
    </Text>
  );

  const base: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.px,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    opacity: isDisabled ? 0.5 : 1,
    alignSelf: fullWidth ? "stretch" : "flex-start",
  };

  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }, fullWidth && { alignSelf: "stretch" }, style]}>
        <LinearGradient
          colors={gradients.brand as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={base}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  const variantStyle: ViewStyle =
    variant === "secondary"
      ? { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderDefault }
      : variant === "danger"
        ? { backgroundColor: colors.lossBg, borderWidth: 1, borderColor: colors.loss }
        : { backgroundColor: "transparent" };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [base, variantStyle, { transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {inner}
    </Pressable>
  );
}

export const buttonStyles = StyleSheet.create({ row: { flexDirection: "row", gap: spacing.sm } });
