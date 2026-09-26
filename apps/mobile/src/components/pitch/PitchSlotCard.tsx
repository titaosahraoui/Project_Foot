import { StyleSheet, View } from "react-native";
import type { AvailableSlot } from "@footconnect/shared";
import { formatPitchPrice } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Icon, Text } from "../ui";
import { formatAlgiersTime } from "../../lib/format-pitch";

export interface PitchSlotCardProps {
  slot: AvailableSlot;
}

export function PitchSlotCard({ slot }: PitchSlotCardProps) {
  const startTime = formatAlgiersTime(slot.startAt);
  const endTime = formatAlgiersTime(slot.endAt);
  const priceText = formatPitchPrice(slot.price);

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Slot from ${startTime} to ${endTime}, price ${priceText}`}
    >
      <View style={styles.timeContainer}>
        <Icon name="clock" size={16} color={colors.primaryContainer} />
        <Text
          variant="headlineMd"
          color={colors.textPrimary}
          style={styles.timeText}
          allowFontScaling={true}
        >
          {startTime} – {endTime}
        </Text>
      </View>

      <View style={styles.priceContainer}>
        <Text
          variant="titleM"
          color={colors.primaryContainer}
          style={styles.priceText}
          allowFontScaling={true}
        >
          {priceText}
        </Text>
        <Text
          variant="labelXs"
          color={colors.onSurfaceVariant}
          allowFontScaling={true}
        >
          PER SLOT
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginVertical: 4,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    flex: 1,
    flexWrap: "wrap",
  },
  timeText: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceText: {
    fontWeight: "700",
  },
});
