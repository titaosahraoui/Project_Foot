import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { OpponentRecommendation } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Avatar, Badge, Button, Card, Icon, Text, TrustSignalRing } from "../ui";
import { formatAlgiersTimeRange } from "../../lib/algiers-time";
import { fontFamily } from "../../theme/fonts";

export interface OpponentCardProps {
  recommendation: OpponentRecommendation;
  onViewTeam: (teamId: string) => void;
}

export function OpponentCard({
  recommendation,
  onViewTeam,
}: OpponentCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const {
    availabilityId: _availId,
    team,
    format,
    distanceKm,
    eloDifference,
    score,
    overlappingWindow,
    explanation,
  } = recommendation;

  const formatLabel =
    format === "FIVE_A_SIDE"
      ? "5v5"
      : format === "SEVEN_A_SIDE"
        ? "7v7"
        : "11v11";

  const diffSign =
    eloDifference > 0 ? `+${eloDifference}` : `${eloDifference}`;

  const ringColor =
    score >= 80
      ? colors.primaryContainer
      : score >= 60
        ? colors.secondaryFixed
        : colors.secondaryFixedDim;

  return (
    <Card style={styles.card}>
      {/* Top Header: Team Logo, Name, Badges */}
      <View style={styles.headerRow}>
        <Avatar name={team.name} size={44} />

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS" color={colors.primary}>
            {team.name}
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={`${team.elo} ELO`} tone="neutral" />
            <Badge label="NEW" tone="brand" />
            <Badge label={formatLabel} tone="neutral" />
          </View>
        </View>

        {/* Recommendation Percentage Ring */}
        <View style={styles.ringBox}>
          <TrustSignalRing percentage={score} size={42} color={ringColor} />
          <Text style={styles.scoreText}>{score}%</Text>
        </View>
      </View>

      {/* Match Specs Bar: Distance (never raw coordinates!) & Overlap */}
      <View style={styles.specsBar}>
        <View style={styles.specItem}>
          <Icon name="map-pin" size={14} color={colors.primaryContainer} />
          <Text variant="labelSm" color={colors.onSurface}>
            {distanceKm} km away
          </Text>
        </View>

        <View style={styles.specDivider} />

        <View style={styles.specItem}>
          <Icon name="clock" size={14} color={colors.primaryContainer} />
          <Text variant="labelSm" color={colors.onSurface}>
            {overlappingWindow.durationMinutes}m overlap
          </Text>
        </View>

        <View style={styles.specDivider} />

        <View style={styles.specItem}>
          <Icon name="shield" size={14} color={colors.onSurfaceVariant} />
          <Text variant="labelSm" color={colors.onSurfaceVariant}>
            {diffSign} ELO diff
          </Text>
        </View>
      </View>

      {/* Time Window Preview in Algiers Local Time */}
      <View style={styles.timeBox}>
        <Icon name="calendar" size={13} color={colors.outline} />
        <Text variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
          {formatAlgiersTimeRange(
            overlappingWindow.startAt,
            overlappingWindow.endAt,
          )}
        </Text>
      </View>

      {/* Explanation Toggle */}
      <TouchableOpacity
        style={styles.explanationToggle}
        onPress={() => setShowExplanation((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Text variant="caption" color={colors.primaryContainer}>
          {showExplanation ? "Hide Score Breakdown" : "Why this match? (Explainable Score)"}
        </Text>
        <Icon
          name={showExplanation ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.primaryContainer}
        />
      </TouchableOpacity>

      {/* Expanded Explanation Section */}
      {showExplanation ? (
        <View style={styles.explanationBox}>
          <View style={styles.explanationRow}>
            <Text variant="caption" color={colors.onSurfaceVariant}>
              Elo Balance (65% weight):
            </Text>
            <Text variant="caption" color={colors.primary}>
              {explanation.eloDifference === 0
                ? "Exact rating match"
                : `${Math.abs(explanation.eloDifference)} pts difference`}
            </Text>
          </View>
          <View style={styles.explanationRow}>
            <Text variant="caption" color={colors.onSurfaceVariant}>
              Proximity (35% weight):
            </Text>
            <Text variant="caption" color={colors.primary}>
              {explanation.distanceKm} km from squad location
            </Text>
          </View>
          <View style={styles.explanationRow}>
            <Text variant="caption" color={colors.onSurfaceVariant}>
              Format Compatibility:
            </Text>
            <Text variant="caption" color={colors.primary}>
              Exact {formatLabel} match
            </Text>
          </View>
          <View style={styles.explanationRow}>
            <Text variant="caption" color={colors.onSurfaceVariant}>
              Reliability:
            </Text>
            <Text variant="caption" color={colors.brand}>
              NEW (Pilot Participant)
            </Text>
          </View>
        </View>
      ) : null}

      {/* Actions: View Team ONLY (Challenge arrives in M07) */}
      <View style={styles.actionsRow}>
        <Button
          label="View Team"
          size="sm"
          variant="secondary"
          onPress={() => onViewTeam(team.id)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 2,
  },
  ringBox: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: 44,
    height: 44,
  },
  scoreText: {
    position: "absolute",
    fontFamily: fontFamily.headline,
    fontSize: 10,
    color: colors.onSurface,
  },
  specsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.layer0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  timeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  explanationToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 2,
  },
  explanationBox: {
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: 4,
    borderLeftWidth: 2,
    borderLeftColor: colors.primaryContainer,
  },
  explanationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionsRow: {
    paddingTop: 4,
  },
});
