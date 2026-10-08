import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MatchChallengeDetail } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Avatar, Badge, Button, Card, Icon, Text } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import {
  formatAlgiersDateTime,
  formatAlgiersTimeRange,
  getChallengeDeadlineInfo,
} from "../lib/algiers-time";
import { useIdempotencyKey } from "../lib/idempotency";
import type { PlayStackParamList } from "../navigation";
import { fontFamily } from "../theme/fonts";

type Props = NativeStackScreenProps<PlayStackParamList, "ChallengeDetail">;

export function ChallengeDetailScreen({ route, navigation }: Props) {
  const { challengeId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [actionInProgress, setActionInProgress] = useState<
    "ACCEPT" | "DECLINE" | "CANCEL" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Retain idempotency keys per user action intent across retries
  const { idempotencyKey: acceptKey } = useIdempotencyKey();
  const { idempotencyKey: declineKey } = useIdempotencyKey();
  const { idempotencyKey: cancelKey } = useIdempotencyKey();

  const {
    data: challenge,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<MatchChallengeDetail>({
    queryKey: ["challenge", challengeId],
    queryFn: () => api.getChallenge(challengeId),
  });

  const invalidateAllChallengeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["challenge", challengeId] }),
      queryClient.invalidateQueries({ queryKey: ["challengeInbox"] }),
      queryClient.invalidateQueries({ queryKey: ["challengeOutbox"] }),
      queryClient.invalidateQueries({ queryKey: ["myAvailability"] }),
      queryClient.invalidateQueries({ queryKey: ["recommendations"] }),
    ]);
  };

  const handleAccept = async () => {
    if (actionInProgress) return;
    setActionInProgress("ACCEPT");
    setActionError(null);

    try {
      await api.acceptChallenge(challengeId, acceptKey);
      await invalidateAllChallengeQueries();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to accept challenge. Please check your network and retry.";
      setActionError(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecline = async () => {
    if (actionInProgress) return;

    const executeDecline = async () => {
      setActionInProgress("DECLINE");
      setActionError(null);

      try {
        await api.declineChallenge(challengeId, declineKey);
        await invalidateAllChallengeQueries();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to decline challenge. Please retry.";
        setActionError(msg);
      } finally {
        setActionInProgress(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to decline this match challenge?")) {
        await executeDecline();
      }
    } else {
      Alert.alert(
        "Decline Challenge",
        "Are you sure you want to decline this match challenge?",
        [
          { text: "Keep Challenge", style: "cancel" },
          {
            text: "Decline",
            style: "destructive",
            onPress: () => {
              void executeDecline();
            },
          },
        ],
      );
    }
  };

  const handleCancel = async () => {
    if (actionInProgress) return;

    const executeCancel = async () => {
      setActionInProgress("CANCEL");
      setActionError(null);

      try {
        await api.cancelChallenge(challengeId, cancelKey);
        await invalidateAllChallengeQueries();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to cancel challenge. Please retry.";
        setActionError(msg);
      } finally {
        setActionInProgress(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to cancel this challenge?")) {
        await executeCancel();
      }
    } else {
      Alert.alert(
        "Cancel Challenge",
        "Are you sure you want to cancel this challenge?",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Challenge",
            style: "destructive",
            onPress: () => {
              void executeCancel();
            },
          },
        ],
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
        <Text
          variant="caption"
          color={colors.textSecondary}
          style={{ marginTop: 12 }}
        >
          Loading challenge details...
        </Text>
      </View>
    );
  }

  if (error || !challenge) {
    return (
      <View style={styles.centerContainer}>
        <Card style={styles.errorCard}>
          <Icon name="alert-triangle" size={28} color={colors.danger} />
          <Text variant="titleS" color={colors.danger}>
            Could Not Load Challenge
          </Text>
          <Text
            variant="caption"
            color={colors.onSurfaceVariant}
            style={{ textAlign: "center" }}
          >
            {error instanceof Error
              ? error.message
              : "This challenge may have expired, or you do not have permission to view it."}
          </Text>
          <Button
            label="Retry"
            size="sm"
            variant="secondary"
            onPress={() => refetch()}
            style={{ marginTop: 8, width: 140 }}
          />
        </Card>
      </View>
    );
  }

  const {
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
    message,
    organizerUserId,
    availableActions,
    respondedAt,
    cancelledAt,
  } = challenge;

  const isOrganizer = user?.id === organizerUserId;
  const isPending = status === "PENDING";
  const isAccepted = status === "ACCEPTED";

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

  const responseDeadlineInfo = getChallengeDeadlineInfo(
    responseDeadline,
    "response",
  );
  const bookingDeadlineInfo = bookingDeadline
    ? getChallengeDeadlineInfo(bookingDeadline, "booking")
    : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primaryContainer}
        />
      }
    >
      {/* Status Bar */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeaderRow}>
          <View style={styles.statusLabelRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status === "ACCEPTED"
                      ? colors.win
                      : status === "DECLINED"
                        ? colors.loss
                        : status === "PENDING"
                          ? colors.primaryContainer
                          : colors.outline,
                },
              ]}
            />
            <Text variant="titleS" color={colors.primary}>
              CHALLENGE {status}
            </Text>
          </View>
          <Badge label={status} tone={statusTone[status]} />
        </View>

        {isPending ? (
          <Text variant="bodySm" color={colors.onSurfaceVariant}>
            {responseDeadlineInfo.isExpired
              ? "Response deadline has expired. This challenge can no longer be accepted."
              : `Opponent captain must respond: ${responseDeadlineInfo.timeRemainingText}.`}
          </Text>
        ) : isAccepted ? (
          <Text variant="bodySm" color={colors.secondary}>
            Match confirmed by captains! Pitch reservation is due before{" "}
            {bookingDeadlineInfo?.formattedDeadline ?? "the deadline"}.
          </Text>
        ) : status === "DECLINED" ? (
          <Text variant="bodySm" color={colors.loss}>
            This match challenge was declined.
            {respondedAt ? ` Responded on ${formatAlgiersDateTime(respondedAt)}.` : ""}
          </Text>
        ) : status === "CANCELLED" ? (
          <Text variant="bodySm" color={colors.onSurfaceVariant}>
            This challenge was cancelled by the match organizer.
            {cancelledAt ? ` Cancelled on ${formatAlgiersDateTime(cancelledAt)}.` : ""}
          </Text>
        ) : (
          <Text variant="bodySm" color={colors.onSurfaceVariant}>
            This challenge window has expired without an agreement.
          </Text>
        )}
      </Card>

      {/* Teams Matchup Header */}
      <Card style={styles.matchupCard}>
        <View style={styles.teamsRow}>
          {/* Challenger */}
          <View style={styles.teamCol}>
            <Avatar name={challengerTeam.name} size={50} />
            <Text
              variant="titleS"
              color={colors.primary}
              style={styles.teamName}
              numberOfLines={2}
            >
              {challengerTeam.name}
            </Text>
            <Badge label="ORGANIZER" tone="brand" />
            <Text variant="caption" color={colors.onSurfaceVariant}>
              {challengerTeam.elo} ELO
            </Text>
          </View>

          {/* VS & Format */}
          <View style={styles.vsBox}>
            <Text style={styles.vsText}>VS</Text>
            <Badge label={formatLabel} tone="neutral" />
          </View>

          {/* Opponent */}
          <View style={styles.teamCol}>
            <Avatar name={opponentTeam.name} size={50} />
            <Text
              variant="titleS"
              color={colors.primary}
              style={styles.teamName}
              numberOfLines={2}
            >
              {opponentTeam.name}
            </Text>
            <Badge label="OPPONENT" tone="neutral" />
            <Text variant="caption" color={colors.onSurfaceVariant}>
              {opponentTeam.elo} ELO
            </Text>
          </View>
        </View>
      </Card>

      {/* Agreed Match Conditions */}
      <Card style={styles.conditionsCard}>
        <Text variant="overline" color={colors.primaryContainer}>
          SNAPSHOTTED CONDITIONS
        </Text>

        <View style={styles.conditionItem}>
          <Icon name="clock" size={16} color={colors.primaryContainer} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelSm" color={colors.onSurfaceVariant}>
              SCHEDULED WINDOW
            </Text>
            <Text variant="body" color={colors.primary}>
              {formatAlgiersTimeRange(startAt, endAt)}
            </Text>
          </View>
        </View>

        <View style={styles.conditionItem}>
          <Icon name="map-pin" size={16} color={colors.primaryContainer} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelSm" color={colors.onSurfaceVariant}>
              LOCATION & SEARCH RADIUS
            </Text>
            <Text variant="body" color={colors.primary}>
              {approximateArea} · {radiusKm} km search radius
            </Text>
          </View>
        </View>

        <View style={styles.conditionItem}>
          <Icon name="shield-check" size={16} color={colors.primaryContainer} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelSm" color={colors.onSurfaceVariant}>
              MATCH ORGANIZER
            </Text>
            <Text variant="body" color={colors.primary}>
              {challengerTeam.name} {isOrganizer ? "(You)" : ""}
            </Text>
          </View>
        </View>
      </Card>

      {/* Deadlines Section */}
      <Card style={styles.deadlinesCard}>
        <Text variant="overline" color={colors.primaryContainer}>
          DEADLINES & TIMELINE
        </Text>

        <View style={styles.deadlineRow}>
          <Text variant="bodySm" color={colors.onSurfaceVariant}>
            Response Deadline:
          </Text>
          <Text
            variant="bodySm"
            color={
              responseDeadlineInfo.isExpired ? colors.loss : colors.primary
            }
          >
            {responseDeadlineInfo.formattedDeadline}
          </Text>
        </View>

        {bookingDeadlineInfo ? (
          <View style={styles.deadlineRow}>
            <Text variant="bodySm" color={colors.onSurfaceVariant}>
              Pitch Booking Deadline:
            </Text>
            <Text
              variant="bodySm"
              color={
                bookingDeadlineInfo.isExpired ? colors.loss : colors.primary
              }
            >
              {bookingDeadlineInfo.formattedDeadline}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Message if present */}
      {message ? (
        <Card style={styles.messageCard}>
          <Text variant="overline" color={colors.primaryContainer}>
            ORGANIZER MESSAGE
          </Text>
          <Text variant="bodySm" color={colors.onSurface}>
            "{message}"
          </Text>
        </Card>
      ) : null}

      {/* Error Callout */}
      {actionError ? (
        <Card style={styles.actionErrorCard}>
          <Icon name="alert-triangle" size={20} color={colors.danger} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleS" color={colors.danger}>
              Action Failed
            </Text>
            <Text variant="caption" color={colors.onSurfaceVariant}>
              {actionError}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Milestone 08 "Choose a pitch" button — only shown to organizer after acceptance */}
      {isAccepted && isOrganizer ? (
        <View style={styles.pitchSection}>
          <Button
            label="Choose a pitch"
            disabled={true}
            variant="primary"
            icon={<Icon name="map-pin" size={16} color={colors.onPrimary} />}
          />
          <Text
            variant="caption"
            color={colors.onSurfaceVariant}
            style={styles.pitchNote}
          >
            Pitch reservation will be unlocked in Milestone 08
          </Text>
        </View>
      ) : null}

      {/* Captain Actions (Accept / Decline for Opponent Captain, Cancel for Organizer) */}
      {availableActions.length > 0 ? (
        <View style={styles.actionsContainer}>
          {/* Opponent Captain Actions */}
          {availableActions.includes("ACCEPT") ? (
            <Button
              label={
                actionInProgress === "ACCEPT"
                  ? "Accepting Match..."
                  : "Accept Challenge"
              }
              variant="primary"
              loading={actionInProgress === "ACCEPT"}
              disabled={actionInProgress !== null}
              onPress={handleAccept}
              icon={
                actionInProgress !== "ACCEPT" ? (
                  <Icon name="check" size={18} color={colors.onPrimary} />
                ) : undefined
              }
            />
          ) : null}

          {availableActions.includes("DECLINE") ? (
            <Button
              label={
                actionInProgress === "DECLINE"
                  ? "Declining..."
                  : "Decline Challenge"
              }
              variant="secondary"
              loading={actionInProgress === "DECLINE"}
              disabled={actionInProgress !== null}
              onPress={handleDecline}
              icon={
                actionInProgress !== "DECLINE" ? (
                  <Icon name="x" size={18} color={colors.textPrimary} />
                ) : undefined
              }
            />
          ) : null}

          {/* Organizer Cancel Action */}
          {availableActions.includes("CANCEL") ? (
            <Button
              label={
                actionInProgress === "CANCEL"
                  ? "Cancelling..."
                  : "Cancel Challenge"
              }
              variant="danger"
              loading={actionInProgress === "CANCEL"}
              disabled={actionInProgress !== null}
              onPress={handleCancel}
              icon={
                actionInProgress !== "CANCEL" ? (
                  <Icon name="trash" size={16} color={colors.loss} />
                ) : undefined
              }
            />
          ) : null}
        </View>
      ) : (
        /* Members see read-only state */
        <View style={styles.readOnlyNoteWrap}>
          <Icon name="info" size={14} color={colors.onSurfaceVariant} />
          <Text variant="caption" color={colors.onSurfaceVariant}>
            Read-only squad view. Only team captains can manage challenge responses.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorCard: {
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  statusCard: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  matchupCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  teamName: {
    textAlign: "center",
    maxWidth: 110,
  },
  vsBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  vsText: {
    fontFamily: fontFamily.headline,
    fontSize: 22,
    color: colors.primaryContainer,
  },
  conditionsCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceContainer,
  },
  conditionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  deadlinesCard: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  deadlineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messageCard: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
  },
  actionErrorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  pitchSection: {
    gap: 6,
    marginTop: spacing.xs,
  },
  pitchNote: {
    textAlign: "center",
  },
  actionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  readOnlyNoteWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
});
