import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { MatchChallengeSummary } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Avatar, Badge, Card, Icon, Text } from "../ui";
import {
  formatAlgiersTimeRange,
  getChallengeDeadlineInfo,
} from "../../lib/algiers-time";
import { fontFamily } from "../../theme/fonts";
import { formatApproximateArea } from "../../lib/approximate-area";

export interface ChallengeCardProps {
  challenge: MatchChallengeSummary;
  perspective: "inbox" | "outbox";
  onPress: (challengeId: string) => void;
}

export function ChallengeCard({
  challenge,
  perspective,
  onPress,
}: ChallengeCardProps) {
  const {
    id,
    challengerTeam,
    opponentTeam,
    format,
    startAt,
    endAt,
    approximateArea,
    radiusKm,
    responseDeadline,
    bookingDeadline,
    status,
    availableActions,
  } = challenge;

  const formatLabel =
    format === "FIVE_A_SIDE"
      ? "5v5"
      : format === "SEVEN_A_SIDE"
        ? "7v7"
        : "11v11";

  const statusTone: Record<
    typeof status,
    "brand" | "win" | "loss" | "neutral" | "draw"
  > = {
    PENDING: "brand",
    ACCEPTED: "win",
    DECLINED: "loss",
    CANCELLED: "neutral",
    EXPIRED: "neutral",
  };

  const isPending = status === "PENDING";
  const isAccepted = status === "ACCEPTED";
  const hasAction = availableActions.includes("ACCEPT");

  // Determine deadline text
  const deadlineInfo = isAccepted && bookingDeadline
    ? getChallengeDeadlineInfo(bookingDeadline, "booking")
    : isPending
      ? getChallengeDeadlineInfo(responseDeadline, "response")
      : null;

  // Primary team to show in focus based on perspective:
  // In inbox: challenger challenged us. We focus on challenger.
  // In outbox: we challenged opponent. We focus on opponent.
  const counterpartTeam =
    perspective === "inbox" ? challengerTeam : opponentTeam;
  const myTeam = perspective === "inbox" ? opponentTeam : challengerTeam;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(id)}
      style={styles.touchable}
    >
      <Card style={styles.card}>
        {/* Top Header: Team Avatars & Status */}
        <View style={styles.headerRow}>
          <View style={styles.teamInfo}>
            <Avatar name={counterpartTeam.name} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleS" color={colors.primary} numberOfLines={1}>
                {counterpartTeam.name}
              </Text>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                {perspective === "inbox" ? "Challenged Your Squad" : "Challenged by You"} · {counterpartTeam.elo} ELO
              </Text>
            </View>
          </View>

          <Badge label={status} tone={statusTone[status]} />
        </View>

        {/* Action Required Banner for Opponent Captain */}
        {hasAction ? (
          <View style={styles.actionRequiredBanner}>
            <Icon name="bell" size={14} color={colors.onPrimary} />
            <Text
              variant="labelXs"
              color={colors.onPrimary}
              style={{ fontWeight: "700" }}
            >
              Action Required: Captain Accept or Decline
            </Text>
          </View>
        ) : null}

        {/* Match Details: Window, Format, Location */}
        <View style={styles.specsBar}>
          <View style={styles.specItem}>
            <Icon name="clock" size={13} color={colors.primaryContainer} />
            <Text variant="caption" color={colors.onSurface} numberOfLines={1}>
              {formatAlgiersTimeRange(startAt, endAt)}
            </Text>
          </View>
        </View>

        {/* Footer: Area/Format and Deadline countdown */}
        <View style={styles.footerRow}>
          <View style={styles.tagsRow}>
            <Badge label={formatLabel} tone="neutral" />
            <Badge
              label={`${formatApproximateArea(approximateArea)} (${radiusKm}km)`}
              tone="neutral"
            />
          </View>

          {deadlineInfo && !deadlineInfo.isExpired ? (
            <Text variant="caption" color={colors.primaryContainer}>
              {deadlineInfo.timeRemainingText}
            </Text>
          ) : deadlineInfo?.isExpired ? (
            <Text variant="caption" color={colors.loss}>
              Expired
            </Text>
          ) : null}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    paddingRight: spacing.xs,
  },
  actionRequiredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  specsBar: {
    backgroundColor: colors.layer0,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
});
