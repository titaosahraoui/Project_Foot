import { StyleSheet, View } from "react-native";
import type { OpponentRecommendation } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Badge, Card, Icon, Text, TrustSignalRing } from "../ui";
import { fontFamily } from "../../theme/fonts";

export interface RecommendationCardProps {
  recommendation: OpponentRecommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { team, score, distanceKm, eloDifference, overlappingWindow, format } =
    recommendation;

  const formatLabel =
    format === "FIVE_A_SIDE"
      ? "5v5"
      : format === "SEVEN_A_SIDE"
        ? "7v7"
        : "11v11";

  const diffSign = eloDifference > 0 ? `+${eloDifference}` : `${eloDifference}`;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text variant="titleS" color={colors.primary}>
            {team.name}
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {team.elo} ELO ({diffSign} vs yours)
          </Text>
        </View>
        <Badge label={formatLabel} tone="neutral" />
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreLeft}>
          <Text variant="labelXs" color={colors.onSurfaceVariant}>
            MATCH QUALITY
          </Text>
          <View style={styles.ringContainer}>
            <TrustSignalRing
              percentage={score}
              size={36}
              color={score >= 80 ? colors.primaryContainer : colors.secondaryFixedDim}
            />
            <Text style={styles.scoreNumber}>{score}</Text>
          </View>
        </View>

        <View style={styles.metaRight}>
          <View style={styles.metaItem}>
            <Icon name="map-pin" color={colors.onSurfaceVariant} size={14} />
            <Text variant="labelSm" color={colors.onSurface}>
              {distanceKm} km away
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="clock" color={colors.onSurfaceVariant} size={14} />
            <Text variant="labelSm" color={colors.onSurface}>
              {overlappingWindow.durationMinutes}m overlap
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.layer0,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  scoreLeft: {
    gap: 4,
  },
  ringContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreNumber: {
    fontFamily: fontFamily.headline,
    fontSize: 16,
    color: colors.primaryContainer,
  },
  metaRight: {
    gap: 6,
    alignItems: "flex-end",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
