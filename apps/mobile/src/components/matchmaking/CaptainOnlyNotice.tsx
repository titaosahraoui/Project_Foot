import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";
import { Card, Icon, Text } from "../ui";

export interface CaptainOnlyNoticeProps {
  style?: ViewStyle;
  teamName?: string;
}

export function CaptainOnlyNotice({ style, teamName }: CaptainOnlyNoticeProps) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.iconRow}>
        <View style={styles.iconBadge}>
          <Icon name="shield" size={18} color={colors.secondaryFixed} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS" color={colors.secondaryFixed}>
            CAPTAIN-ONLY CONTROL
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {teamName ? `For squad ${teamName}: ` : ""}You are viewing availability in read-only mode. Only the team captain can create or cancel match windows.
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});
