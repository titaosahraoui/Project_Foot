import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { OpponentRecommendation, TeamAvailability } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Badge, Button, Card, Icon, Text } from "../ui";
import {
  formatAlgiersTimeRange,
  getAvailabilityCountdown,
} from "../../lib/algiers-time";
import { api } from "../../lib/api";
import { RecommendationCard } from "./RecommendationCard";

export interface AvailabilityCardProps {
  availability: TeamAvailability;
  teamName?: string;
  isCaptain?: boolean;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
  onViewRecommendations?: (id: string) => void;
}

export function AvailabilityCard({
  availability,
  teamName,
  isCaptain = false,
  onCancel,
  isCancelling = false,
  onViewRecommendations,
}: AvailabilityCardProps) {
  const [showRecommendations, setShowRecommendations] = useState(false);

  const {
    id,
    format,
    status,
    startAt,
    endAt,
    expiresAt,
    radiusKm,
    eloTolerance,
    approximateArea,
    message,
  } = availability;

  const countdown = getAvailabilityCountdown(status, startAt, endAt, expiresAt);

  const statusTone: Record<
    TeamAvailability["status"],
    "win" | "brand" | "neutral" | "loss"
  > = {
    OPEN: "win",
    MATCHED: "brand",
    CANCELLED: "neutral",
    EXPIRED: "loss",
  };

  const formatLabel =
    format === "FIVE_A_SIDE"
      ? "5v5"
      : format === "SEVEN_A_SIDE"
        ? "7v7"
        : "11v11";

  // Recommendations query only fetches when explicitly opened on an OPEN availability
  const {
    data: recsData,
    isLoading: recsLoading,
    error: recsError,
    refetch: refetchRecs,
  } = useQuery({
    queryKey: ["availabilityRecommendations", id],
    queryFn: () => api.getRecommendations(id),
    enabled: showRecommendations && status === "OPEN",
    staleTime: 30000,
  });

  const handleCancelPress = () => {
    Alert.alert(
      "Cancel Availability?",
      "Other teams will no longer be able to find or match with your team during this window.",
      [
        { text: "Keep Window", style: "cancel" },
        {
          text: "Cancel Window",
          style: "destructive",
          onPress: () => onCancel?.(id),
        },
      ],
    );
  };

  return (
    <Card style={styles.card}>
      {/* Top Header: Team Name, Format & Status Badge */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text variant="titleS" color={colors.primary}>
            {teamName ?? "Squad Availability"}
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {formatAlgiersTimeRange(startAt, endAt)}
          </Text>
        </View>
        <View style={styles.badgeGroup}>
          <Badge label={formatLabel} tone="neutral" />
          <Badge label={status} tone={statusTone[status]} />
        </View>
      </View>

      {/* Countdown / Deadline info bar */}
      <View
        style={[
          styles.countdownBar,
          countdown.isExpired && styles.countdownBarExpired,
        ]}
      >
        <Icon
          name="clock"
          size={14}
          color={countdown.isExpired ? colors.loss : colors.primaryContainer}
        />
        <View style={{ flex: 1 }}>
          <Text
            variant="labelSm"
            color={countdown.isExpired ? colors.loss : colors.primaryContainer}
          >
            {countdown.headline}
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {countdown.detail}
          </Text>
        </View>
      </View>

      {/* Scope & Tolerance Badges */}
      <View style={styles.specRow}>
        <View style={styles.specChip}>
          <Icon name="map-pin" size={13} color={colors.outline} />
          <Text style={styles.specText}>
            {approximateArea
              ? `~${approximateArea.lat.toFixed(2)}, ${approximateArea.lng.toFixed(2)}`
              : "Algiers"}{" "}
            · {radiusKm} km
          </Text>
        </View>

        <View style={styles.specChip}>
          <Icon name="shield" size={13} color={colors.outline} />
          <Text style={styles.specText}>±{eloTolerance} ELO</Text>
        </View>
      </View>

      {/* Message if present */}
      {message ? (
        <View style={styles.messageBox}>
          <Icon name="edit" size={13} color={colors.outline} />
          <Text variant="caption" color={colors.onSurface} style={{ flex: 1 }}>
            "{message}"
          </Text>
        </View>
      ) : null}

      {/* Captain Actions: Cancel Button */}
      {isCaptain && status === "OPEN" ? (
        <View style={styles.actionsRow}>
          <Button
            label="Cancel Window"
            variant="danger"
            size="sm"
            loading={isCancelling}
            onPress={handleCancelPress}
            style={styles.cancelBtn}
          />
          <TouchableOpacity
            style={styles.recToggleBtn}
            onPress={() => {
              if (onViewRecommendations) {
                onViewRecommendations(id);
              } else {
                setShowRecommendations((prev) => !prev);
              }
            }}
            activeOpacity={0.7}
          >
            <Text variant="labelSm" color={colors.primaryContainer}>
              {onViewRecommendations
                ? "Find Opponents"
                : showRecommendations
                  ? "Hide Opponents"
                  : "Find Opponents"}
            </Text>
            <Icon
              name={
                onViewRecommendations
                  ? "chevron-right"
                  : showRecommendations
                    ? "chevron-up"
                    : "chevron-down"
              }
              size={16}
              color={colors.primaryContainer}
            />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Recommendations view on demand */}
      {showRecommendations && status === "OPEN" ? (
        <View style={styles.recsSection}>
          <Text variant="labelSm" color={colors.onSurfaceVariant}>
            RECOMMENDED OPPONENTS
          </Text>

          {recsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primaryContainer} />
              <Text variant="caption" color={colors.textSecondary}>
                Searching for matching opponents...
              </Text>
            </View>
          ) : recsError ? (
            <View style={styles.errorBox}>
              <Text variant="caption" color={colors.danger}>
                Could not load recommendations.
              </Text>
              <Button
                label="Retry"
                size="sm"
                variant="ghost"
                onPress={() => refetchRecs()}
              />
            </View>
          ) : recsData?.items && recsData.items.length > 0 ? (
            recsData.items.map((rec: OpponentRecommendation) => (
              <RecommendationCard
                key={rec.availabilityId}
                recommendation={rec}
              />
            ))
          ) : (
            <Text variant="caption" color={colors.textSecondary}>
              No matching opponents found within your radius and Elo range yet.
            </Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceContainer,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  badgeGroup: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  countdownBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(195, 244, 0, 0.06)",
    borderColor: "rgba(195, 244, 0, 0.2)",
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  countdownBarExpired: {
    backgroundColor: "rgba(255, 68, 68, 0.06)",
    borderColor: "rgba(255, 68, 68, 0.2)",
  },
  specRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  specChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  specText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  messageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.layer0,
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  cancelBtn: {
    flex: 1,
    marginRight: spacing.sm,
  },
  recToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recsSection: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: spacing.sm,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
