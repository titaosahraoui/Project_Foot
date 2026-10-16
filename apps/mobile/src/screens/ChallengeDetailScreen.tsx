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
import { formatPitchPrice } from "@footconnect/shared";
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
import { formatApproximateArea } from "../lib/approximate-area";
import type { PlayStackParamList } from "../navigation";
import { fontFamily } from "../theme/fonts";
import { executeGuardedAction } from "../lib/action-guard";

type Props = NativeStackScreenProps<PlayStackParamList, "ChallengeDetail">;

export function ChallengeDetailScreen({ route, navigation }: Props) {
  const { challengeId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [actionInProgress, setActionInProgress] = useState<
    "ACCEPT" | "DECLINE" | "CANCEL" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<
    "ACCEPT" | "DECLINE" | "CANCEL" | null
  >(null);

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

  // Query any existing pitch booking for this challenge
  const {
    data: bookingsData,
    refetch: refetchBookings,
    isRefetching: isRefetchingBookings,
  } = useQuery({
    queryKey: ["challenge-bookings", challengeId],
    queryFn: () => api.getMyBookings({ page: 1, pageSize: 10, challengeId }),
    enabled: !!challenge && challenge.status === "ACCEPTED",
    refetchInterval: 10000,
  });

  const activeBooking =
    bookingsData?.items.find(
      (b) =>
        b.status === "PENDING_OWNER_CONFIRMATION" ||
        b.status === "CONFIRMED",
    ) ?? bookingsData?.items[0];

  const invalidateAllChallengeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["challenge", challengeId] }),
      queryClient.invalidateQueries({ queryKey: ["challenges-inbox"] }),
      queryClient.invalidateQueries({ queryKey: ["challenges-outbox"] }),
      queryClient.invalidateQueries({ queryKey: ["my-availabilities"] }),
      queryClient.invalidateQueries({ queryKey: ["recommendations"] }),
      queryClient.invalidateQueries({ queryKey: ["challenge-bookings", challengeId] }),
    ]);
  };

  const runGuardedAction = async (
    action: "ACCEPT" | "DECLINE" | "CANCEL",
    task: () => Promise<void>,
  ) => {
    await executeGuardedAction(
      action,
      {
        actionInProgress,
        setActionInProgress,
        setLastAction,
        setActionError,
      },
      task,
    );
  };

  const handleAccept = async () => {
    await runGuardedAction("ACCEPT", async () => {
      await api.acceptChallenge(challengeId, acceptKey);
      await invalidateAllChallengeQueries();
    });
  };

  const handleDecline = async () => {
    const executeDecline = async () => {
      await runGuardedAction("DECLINE", async () => {
        await api.declineChallenge(challengeId, declineKey);
        await invalidateAllChallengeQueries();
      });
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
          { text: "Keep", style: "cancel" },
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
    const executeCancel = async () => {
      await runGuardedAction("CANCEL", async () => {
        await api.cancelChallenge(challengeId, cancelKey);
        await invalidateAllChallengeQueries();
      });
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

  const handleCancelBooking = async (bookingId: string) => {
    const doCancel = async () => {
      try {
        await api.cancelBooking(bookingId);
        await Promise.all([
          refetchBookings(),
          refetch(),
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
        ]);
        Alert.alert("Reservation Cancelled", "Your pitch reservation request has been cancelled.");
      } catch (err: unknown) {
        Alert.alert("Cancellation Failed", err instanceof Error ? err.message : String(err));
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to cancel this pitch reservation?")) {
        void doCancel();
      }
    } else {
      Alert.alert(
        "Cancel Pitch Reservation",
        "Are you sure you want to cancel this pending reservation?",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Reservation",
            style: "destructive",
            onPress: () => void doCancel(),
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
          refreshing={isRefetching || isRefetchingBookings}
          onRefresh={() => {
            void refetch();
            void refetchBookings();
          }}
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
              {formatApproximateArea(approximateArea)} · {radiusKm} km search radius
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

      {/* Pitch Reservation Tracking Section */}
      {activeBooking ? (
        <Card style={styles.bookingStatusCard}>
          <View style={styles.bookingStatusHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="overline" color={colors.primaryContainer}>
                PITCH RESERVATION STATUS
              </Text>
              <Text variant="titleS" color={colors.primary} style={{ marginTop: 2 }}>
                {activeBooking.pitch?.name ?? "Pitch Reservation"}
              </Text>
            </View>
            <Badge
              label={activeBooking.status.replace(/_/g, " ")}
              tone={
                activeBooking.status === "CONFIRMED"
                  ? "win"
                  : activeBooking.status === "PENDING_OWNER_CONFIRMATION"
                    ? "brand"
                    : "loss"
              }
            />
          </View>

          <View style={styles.bookingDetailRow}>
            <Icon name="clock" size={16} color={colors.primaryContainer} />
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                SLOT TIME
              </Text>
              <Text variant="bodySm" color={colors.primary}>
                {formatAlgiersTimeRange(activeBooking.startAt, activeBooking.endAt)}
              </Text>
            </View>
          </View>

          <View style={styles.bookingDetailRow}>
            <Icon name="award" size={16} color={colors.primaryContainer} />
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                SNAPSHOT PRICE
              </Text>
              <Text variant="titleS" color={colors.primaryContainer}>
                {formatPitchPrice({
                  amountMinor: activeBooking.priceAmountMinor,
                  currency: activeBooking.currency,
                })}
              </Text>
            </View>
          </View>

          {activeBooking.status === "PENDING_OWNER_CONFIRMATION" ? (
            <View style={styles.pendingNoteBox}>
              <Icon name="clock" size={14} color={colors.primaryContainer} />
              <Text variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
                Awaiting owner confirmation. Response due by{" "}
                {formatAlgiersDateTime(activeBooking.ownerResponseDeadline)}.
              </Text>
            </View>
          ) : activeBooking.status === "CONFIRMED" ? (
            <View style={styles.confirmedNoteBox}>
              <Icon name="check" size={16} color={colors.win} />
              <Text variant="caption" color={colors.win} style={{ flex: 1, fontWeight: "600" }}>
                Pitch reserved and match scheduled! Payment settled offline at the venue.
              </Text>
            </View>
          ) : (
            <View style={styles.declinedNoteBox}>
              <Icon name="alert-triangle" size={16} color={colors.loss} />
              <Text variant="caption" color={colors.loss} style={{ flex: 1 }}>
                Previous reservation was {activeBooking.status.toLowerCase().replace(/_/g, " ")}. You can select another pitch slot before the booking deadline.
              </Text>
            </View>
          )}

          {isOrganizer && activeBooking.status === "PENDING_OWNER_CONFIRMATION" ? (
            <Button
              label="Cancel Reservation"
              size="sm"
              variant="danger"
              onPress={() => handleCancelBooking(activeBooking.id)}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </Card>
      ) : null}

      {/* Error / Offline Retry Callout */}
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
          {lastAction ? (
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              onPress={() => {
                if (lastAction === "ACCEPT") void handleAccept();
                else if (lastAction === "DECLINE") void handleDecline();
                else if (lastAction === "CANCEL") void handleCancel();
              }}
              disabled={actionInProgress !== null}
              style={{ width: 80 }}
            />
          ) : null}
        </Card>
      ) : null}

      {/* "Choose a pitch" button — active for organizer after acceptance when no blocking reservation */}
      {isAccepted &&
      isOrganizer &&
      (!activeBooking ||
        activeBooking.status === "DECLINED" ||
        activeBooking.status === "EXPIRED" ||
        activeBooking.status === "CANCELLED_BY_OWNER" ||
        activeBooking.status === "CANCELLED_BY_TEAM") ? (
        <View style={styles.pitchSection}>
          <Button
            label="Choose a pitch"
            disabled={false}
            variant="primary"
            onPress={() =>
              navigation.navigate("ChoosePitch", {
                challengeId: challenge.id,
                challenge,
              })
            }
            icon={<Icon name="map-pin" size={16} color={colors.onPrimary} />}
          />
          <Text
            variant="caption"
            color={colors.onSurfaceVariant}
            style={styles.pitchNote}
          >
            Find and book an available pitch matching the accepted conditions
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
                  <Icon name="trash-2" size={16} color={colors.loss} />
                ) : undefined
              }
            />
          ) : null}
        </View>
      ) : isPending ? (
        /* Members see read-only state during pending challenge */
        <View style={styles.readOnlyNoteWrap}>
          <Icon name="info" size={14} color={colors.onSurfaceVariant} />
          <Text variant="caption" color={colors.onSurfaceVariant}>
            Read-only squad view. Only team captains can manage challenge responses.
          </Text>
        </View>
      ) : null}
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
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchupCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  teamName: {
    textAlign: "center",
    fontFamily: fontFamily.headline,
  },
  vsBox: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  vsText: {
    color: colors.primaryContainer,
    fontSize: 16,
    fontFamily: fontFamily.display,
    letterSpacing: 2,
  },
  conditionsCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: spacing.sm,
  },
  conditionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  deadlinesCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: spacing.xs,
  },
  deadlineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messageCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: spacing.xs,
  },
  bookingStatusCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(195, 244, 0, 0.3)",
    gap: spacing.sm,
  },
  bookingStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: spacing.xs,
  },
  bookingDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(195, 244, 0, 0.08)",
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  confirmedNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 253, 147, 0.1)",
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  declinedNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 84, 73, 0.12)",
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  actionErrorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 84, 73, 0.1)",
    borderColor: colors.danger,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  pitchSection: {
    gap: spacing.xs,
  },
  pitchNote: {
    textAlign: "center",
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  readOnlyNoteWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
