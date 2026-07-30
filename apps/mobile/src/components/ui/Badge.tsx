import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";
import { Text } from "./Text";

type Tone = "neutral" | "brand" | "win" | "loss" | "draw";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surface3, fg: colors.textSecondary },
  brand: { bg: colors.winBg, fg: colors.brand },
  win: { bg: colors.winBg, fg: colors.win },
  loss: { bg: colors.lossBg, fg: colors.loss },
  draw: { bg: colors.drawBg, fg: colors.draw },
};

export function Badge({ label, tone = "neutral", style }: { label: string; tone?: Tone; style?: ViewStyle }) {
  const t = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text variant="overline" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
});
