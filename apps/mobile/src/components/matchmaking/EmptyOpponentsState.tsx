import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";
import { Button, Card, Icon, Text } from "../ui";

export interface EmptyOpponentsStateProps {
  onEditAvailability: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function EmptyOpponentsState({
  onEditAvailability,
  onRefresh,
  isRefreshing = false,
}: EmptyOpponentsStateProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon name="search" size={32} color={colors.primaryContainer} />
      </View>

      <Text variant="headlineMd" color={colors.primary} style={{ textAlign: "center" }}>
        NO MATCHING TEAMS YET
      </Text>

      <Text
        variant="body"
        color={colors.textSecondary}
        style={{ textAlign: "center", lineHeight: 20 }}
      >
        We couldn't find an available opponent within your search radius and Elo tolerance for this time slot.
      </Text>

      {/* Pilot onboarding note */}
      <View style={styles.pilotBox}>
        <View style={styles.pilotHeader}>
          <Icon name="award" size={16} color={colors.secondaryFixed} />
          <Text variant="labelSm" color={colors.secondaryFixed}>
            ALGIERS PILOT NETWORK
          </Text>
        </View>
        <Text variant="caption" color={colors.onSurfaceVariant} style={{ lineHeight: 16 }}>
          New squads are joining FootConnect weekly across Algiers. You can expand your search radius up to 50 km or widen your Elo tolerance to increase your match chances.
        </Text>
      </View>

      <View style={styles.btnCol}>
        <Button
          label="Adjust Availability Settings"
          onPress={onEditAvailability}
          style={{ width: "100%" }}
        />
        {onRefresh ? (
          <Button
            label="Check Again"
            variant="secondary"
            loading={isRefreshing}
            onPress={onRefresh}
            style={{ width: "100%" }}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceContainer,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: "rgba(195, 244, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pilotBox: {
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing.sm,
    borderRadius: radii.md,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    width: "100%",
  },
  pilotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btnCol: {
    width: "100%",
    gap: spacing.xs,
    marginTop: 4,
  },
});
