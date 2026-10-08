import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  calculateChallengeResponseDeadline,
  type TeamAvailability,
} from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Avatar, Badge, Button, Card, Icon, Text } from "../components/ui";
import { api } from "../lib/api";
import {
  formatAlgiersDateTime,
  formatAlgiersTimeRange,
} from "../lib/algiers-time";
import { useIdempotencyKey } from "../lib/idempotency";
import type { PlayStackParamList } from "../navigation";
import { fontFamily } from "../theme/fonts";

type Props = NativeStackScreenProps<
  PlayStackParamList,
  "SendChallengeConfirmation"
>;

export function SendChallengeConfirmationScreen({ route, navigation }: Props) {
  const { challengerAvailability, recommendation } = route.params;
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Retain the idempotency key across network retries for this user intent
  const { idempotencyKey } = useIdempotencyKey();

  // Load challenger team info for header display
  const { data: challengerTeam } = useQuery({
    queryKey: ["team", challengerAvailability.teamId],
    queryFn: () => api.getTeam(challengerAvailability.teamId),
    enabled: Boolean(challengerAvailability.teamId),
  });

  const { team: opponentTeam, format, overlappingWindow, distanceKm } =
    recommendation;

  const formatLabel =
    format === "FIVE_A_SIDE"
      ? "5v5"
      : format === "SEVEN_A_SIDE"
        ? "7v7"
        : "11v11";

  // Calculate response deadline
  const responseDeadline = useMemo(() => {
    return calculateChallengeResponseDeadline(
      new Date(),
      new Date(overlappingWindow.startAt),
    );
  }, [overlappingWindow.startAt]);

  const responseDeadlineFormatted = formatAlgiersDateTime(
    responseDeadline.toISOString(),
  );

  const approxArea =
    overlappingWindow.approximateArea ||
    challengerAvailability.approximateArea ||
    "Algiers Area";

  const handleSendChallenge = async () => {
    // Prevent double taps
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const challenge = await api.createChallenge(
        {
          challengerAvailabilityId: challengerAvailability.id,
          opponentAvailabilityId: recommendation.availabilityId,
          challengerTeamId: challengerAvailability.teamId,
          opponentTeamId: opponentTeam.id,
          message: message.trim() || undefined,
        },
        idempotencyKey,
      );

      // Invalidate matchmaking, availability, and challenge queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recommendations"] }),
        queryClient.invalidateQueries({ queryKey: ["myAvailability"] }),
        queryClient.invalidateQueries({ queryKey: ["challengeOutbox"] }),
        queryClient.invalidateQueries({ queryKey: ["challengeInbox"] }),
      ]);

      // Navigate to challenge detail screen (replace to prevent duplicate back submit)
      navigation.replace("ChallengeDetail", { challengeId: challenge.id });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to send challenge. Please check your connection and retry.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Matchup Header: Both Teams */}
        <Card style={styles.matchupCard}>
          <Text variant="overline" color={colors.primaryContainer}>
            PROPOSED MATCHUP
          </Text>

          <View style={styles.teamsRow}>
            {/* Challenger Squad */}
            <View style={styles.teamCol}>
              <Avatar
                name={challengerTeam?.name ?? "Your Squad"}
                size={52}
              />
              <Text
                variant="titleS"
                color={colors.primary}
                style={styles.teamName}
                numberOfLines={2}
              >
                {challengerTeam?.name ?? "Your Squad"}
              </Text>
              <Badge label="ORGANIZER" tone="brand" />
            </View>

            {/* VS Badge */}
            <View style={styles.vsBox}>
              <Text style={styles.vsText}>VS</Text>
              <Badge label={formatLabel} tone="neutral" />
            </View>

            {/* Opponent Squad */}
            <View style={styles.teamCol}>
              <Avatar name={opponentTeam.name} size={52} />
              <Text
                variant="titleS"
                color={colors.primary}
                style={styles.teamName}
                numberOfLines={2}
              >
                {opponentTeam.name}
              </Text>
              <Badge label={`${opponentTeam.elo} ELO`} tone="neutral" />
            </View>
          </View>
        </Card>

        {/* Agreed Conditions Summary */}
        <Card style={styles.conditionsCard}>
          <Text variant="overline" color={colors.primaryContainer}>
            AGREED MATCH CONDITIONS
          </Text>

          {/* Time Window */}
          <View style={styles.conditionRow}>
            <View style={styles.iconCircle}>
              <Icon name="clock" size={16} color={colors.primaryContainer} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                MATCH WINDOW (ALGIERS TIME)
              </Text>
              <Text variant="body" color={colors.primary}>
                {formatAlgiersTimeRange(
                  overlappingWindow.startAt,
                  overlappingWindow.endAt,
                )}
              </Text>
            </View>
          </View>

          {/* Area & Radius */}
          <View style={styles.conditionRow}>
            <View style={styles.iconCircle}>
              <Icon name="map-pin" size={16} color={colors.primaryContainer} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                AREA & SEARCH RADIUS
              </Text>
              <Text variant="body" color={colors.primary}>
                {approxArea} · {challengerAvailability.radiusKm} km radius
              </Text>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                {distanceKm} km proximity between squads
              </Text>
            </View>
          </View>

          {/* Response Deadline */}
          <View style={styles.conditionRow}>
            <View style={styles.iconCircle}>
              <Icon name="calendar" size={16} color={colors.primaryContainer} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                RESPONSE DEADLINE
              </Text>
              <Text variant="body" color={colors.primary}>
                {responseDeadlineFormatted}
              </Text>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                Opponent captain must respond within 24h (or 4h before match start).
              </Text>
            </View>
          </View>
        </Card>

        {/* Organizer Responsibility Notice */}
        <Card style={styles.organizerNoticeCard}>
          <View style={styles.organizerNoticeHeader}>
            <Icon name="shield-check" size={20} color={colors.primaryContainer} />
            <Text variant="titleS" color={colors.primaryContainer}>
              ORGANIZER RESPONSIBILITY
            </Text>
          </View>
          <Text
            variant="bodySm"
            color={colors.textSecondary}
            style={styles.organizerNoticeBody}
          >
            As the challenging squad, your captain becomes the designated Match
            Organizer. Once the opponent captain accepts, you are responsible for
            selecting and booking the pitch before the booking deadline.
          </Text>
        </Card>

        {/* Tactical Message Input */}
        <Card style={styles.messageCard}>
          <View style={styles.messageHeaderRow}>
            <Text variant="overline" color={colors.primaryContainer}>
              MESSAGE TO OPPONENT CAPTAIN
            </Text>
            <Text variant="caption" color={colors.onSurfaceVariant}>
              {message.length} / 280
            </Text>
          </View>
          <TextInput
            placeholder="Add an optional message, squad pitch preference, or tactical note..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            maxLength={280}
            multiline
            numberOfLines={3}
            style={styles.messageInput}
          />
        </Card>

        {/* Error / Offline Retry Callout */}
        {errorMessage ? (
          <Card style={styles.errorCard}>
            <Icon name="alert-triangle" size={20} color={colors.danger} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleS" color={colors.danger}>
                Could Not Send Challenge
              </Text>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                {errorMessage}
              </Text>
            </View>
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              onPress={handleSendChallenge}
              disabled={isSubmitting}
              style={{ width: 80 }}
            />
          </Card>
        ) : null}

        {/* Send Action */}
        <View style={styles.actionSection}>
          <Button
            label={isSubmitting ? "Sending Challenge..." : "Confirm & Send Challenge"}
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleSendChallenge}
            icon={
              !isSubmitting ? (
                <Icon name="arrow-right" size={16} color={colors.onPrimary} />
              ) : undefined
            }
          />
          <Button
            label="Cancel"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.xs }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  matchupCard: {
    gap: spacing.md,
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
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  conditionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.layer0,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  organizerNoticeCard: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerHigh,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: "rgba(195, 244, 0, 0.2)",
  },
  organizerNoticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  organizerNoticeBody: {
    lineHeight: 20,
  },
  messageCard: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
  },
  messageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messageInput: {
    backgroundColor: colors.layer0,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 80,
    fontFamily: "Archivo_500Medium",
    fontSize: 14,
    textAlignVertical: "top",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  actionSection: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
});
