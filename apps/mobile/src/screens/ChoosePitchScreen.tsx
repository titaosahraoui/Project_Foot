import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  AvailableSlot,
  MatchChallengeDetail,
  Pitch,
} from "@footconnect/shared";
import { formatPitchPrice } from "@footconnect/shared";
import { colors } from "@footconnect/ui";
import type { PlayStackParamList } from "../navigation";
import { api } from "../lib/api";
import {
  formatAlgiersDateTime,
  formatAlgiersTimeRange,
  getChallengeDeadlineInfo,
} from "../lib/algiers-time";
import { formatApproximateArea } from "../lib/approximate-area";
import {
  calculateDistanceKm,
  formatDistance,
} from "../lib/geo";
import {
  formatAlgiersTime,
  formatPitchFormat,
  formatPitchSurface,
} from "../lib/format-pitch";
import { useIdempotencyKey } from "../lib/idempotency";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Text,
} from "../components/ui";

type Props = NativeStackScreenProps<PlayStackParamList, "ChoosePitch">;

export function ChoosePitchScreen({ route, navigation }: Props) {
  const { challengeId, challenge: initialChallenge } = route.params;
  const queryClient = useQueryClient();

  const { idempotencyKey, resetKey } = useIdempotencyKey();

  // Load latest challenge details
  const {
    data: challenge,
    isLoading: challengeLoading,
    error: challengeError,
    refetch: refetchChallenge,
  } = useQuery<MatchChallengeDetail>({
    queryKey: ["challenge-detail", challengeId],
    queryFn: () => api.getChallenge(challengeId),
    initialData: initialChallenge,
  });

  // Calculate available durations within accepted window
  const windowDurationMin = useMemo(() => {
    if (!challenge) return 90;
    const start = new Date(challenge.startAt).getTime();
    const end = new Date(challenge.endAt).getTime();
    return Math.max(30, Math.round((end - start) / (60 * 1000)));
  }, [challenge]);

  const durationOptions = useMemo(() => {
    const standard = [60, 90, 120];
    const filtered = standard.filter((d) => d <= windowDurationMin);
    return filtered.length > 0 ? filtered : [windowDurationMin];
  }, [windowDurationMin]);

  const [selectedDuration, setSelectedDuration] = useState<number>(() => {
    if (windowDurationMin >= 90) return 90;
    if (windowDurationMin >= 60) return 60;
    return windowDurationMin;
  });

  // Fetch pitches matching agreed format and within search radius
  const {
    data: pitches,
    isLoading: pitchesLoading,
    isRefetching: pitchesRefetching,
    refetch: refetchPitches,
  } = useQuery<Pitch[]>({
    queryKey: [
      "pitches-for-challenge",
      challenge?.format,
      challenge?.approximateArea.lat,
      challenge?.approximateArea.lng,
      challenge?.radiusKm,
    ],
    queryFn: () => {
      if (!challenge) return Promise.resolve([]);
      return api.getPitches({
        format: challenge.format,
        lat: challenge.approximateArea.lat,
        lng: challenge.approximateArea.lng,
        radiusKm: challenge.radiusKm,
      });
    },
    enabled: !!challenge,
  });

  // Selection & Confirmation State
  const [selectedPitch, setSelectedPitch] = useState<Pitch | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const handleOpenConfirm = (pitch: Pitch, slot: AvailableSlot) => {
    setSelectedPitch(pitch);
    setSelectedSlot(slot);
    setConflictError(null);
    setIsConfirmModalOpen(true);
  };

  const handleCloseConfirm = () => {
    if (isSubmitting) return;
    setIsConfirmModalOpen(false);
    setSelectedPitch(null);
    setSelectedSlot(null);
    setConflictError(null);
  };

  // Submit booking creation with stable idempotency key
  const handleConfirmBooking = async () => {
    if (!challenge || !selectedPitch || !selectedSlot || isSubmitting) return;

    setIsSubmitting(true);
    setConflictError(null);

    try {
      await api.createBooking(
        {
          pitchId: selectedPitch.id,
          challengeId: challenge.id,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
        },
        idempotencyKey,
      );

      // Successfully created booking!
      resetKey();
      setIsConfirmModalOpen(false);

      // Invalidate relevant query caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["challenge-bookings", challenge.id] }),
        queryClient.invalidateQueries({ queryKey: ["challenge-detail", challenge.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] }),
      ]);

      Alert.alert(
        "Reservation Requested! ⚽",
        `Your pitch booking request at ${selectedPitch.name} has been sent to the facility owner. You will be notified once they respond.`,
        [
          {
            text: "View Status",
            onPress: () => navigation.navigate("ChallengeDetail", { challengeId: challenge.id }),
          },
        ],
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Detect inventory collision / conflict
      if (
        errorMsg.includes("INVENTORY_CONFLICT") ||
        errorMsg.includes("409") ||
        errorMsg.includes("conflict") ||
        errorMsg.includes("no longer available")
      ) {
        setConflictError(
          "This pitch slot was just booked or is no longer available. Pitch inventory has been refreshed. Please pick another available slot.",
        );
        resetKey();
        // Invalidate slots for this pitch
        void queryClient.invalidateQueries({
          queryKey: ["pitch-slots-for-challenge", selectedPitch.id],
        });
      } else {
        Alert.alert("Booking Failed", errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (challengeLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
        <Text variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: 12 }}>
          Loading challenge terms...
        </Text>
      </View>
    );
  }

  if (challengeError || !challenge) {
    return (
      <View style={styles.centerContainer}>
        <Card style={styles.errorCard}>
          <Icon name="alert-triangle" size={28} color={colors.danger} />
          <Text variant="titleS" color={colors.danger}>
            Could Not Load Challenge
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            {challengeError instanceof Error
              ? challengeError.message
              : "Unable to retrieve challenge details."}
          </Text>
          <Button
            label="Retry"
            size="sm"
            variant="secondary"
            onPress={() => refetchChallenge()}
            style={{ marginTop: 8, width: 140 }}
          />
        </Card>
      </View>
    );
  }

  const bookingDeadlineInfo = challenge.bookingDeadline
    ? getChallengeDeadlineInfo(challenge.bookingDeadline, "booking")
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={pitchesRefetching}
            onRefresh={() => {
              void refetchChallenge();
              void refetchPitches();
            }}
            tintColor={colors.primaryContainer}
          />
        }
      >
        {/* Conditions Summary Card */}
        <Card style={styles.conditionsCard}>
          <View style={styles.conditionsHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text variant="overline" color={colors.primaryContainer}>
                ACCEPTED MATCH CONDITIONS
              </Text>
              <Text variant="titleS" color={colors.primary} style={{ marginTop: 2 }}>
                {challenge.challengerTeam.name} vs {challenge.opponentTeam.name}
              </Text>
            </View>
            <Badge
              label={formatPitchFormat(challenge.format)}
              tone="brand"
            />
          </View>

          <View style={styles.conditionRow}>
            <Icon name="clock" size={16} color={colors.primaryContainer} />
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                AGREED WINDOW
              </Text>
              <Text variant="bodySm" color={colors.primary}>
                {formatAlgiersTimeRange(challenge.startAt, challenge.endAt)}
              </Text>
            </View>
          </View>

          <View style={styles.conditionRow}>
            <Icon name="map-pin" size={16} color={colors.primaryContainer} />
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                LOCATION & SEARCH RADIUS
              </Text>
              <Text variant="bodySm" color={colors.primary}>
                {formatApproximateArea(challenge.approximateArea)} · within {challenge.radiusKm} km radius
              </Text>
            </View>
          </View>

          {bookingDeadlineInfo ? (
            <View style={styles.conditionRow}>
              <Icon name="alert-triangle" size={16} color={bookingDeadlineInfo.isExpired ? colors.loss : colors.primaryContainer} />
              <View style={{ flex: 1 }}>
                <Text variant="labelSm" color={colors.onSurfaceVariant}>
                  BOOKING DEADLINE
                </Text>
                <Text
                  variant="bodySm"
                  color={bookingDeadlineInfo.isExpired ? colors.loss : colors.primary}
                >
                  {bookingDeadlineInfo.timeRemainingText} ({bookingDeadlineInfo.formattedDeadline})
                </Text>
              </View>
            </View>
          ) : null}

          {/* Duration Selector */}
          {durationOptions.length > 1 ? (
            <View style={styles.durationSelectorContainer}>
              <Text variant="labelSm" color={colors.onSurfaceVariant} style={{ marginBottom: 6 }}>
                MATCH DURATION
              </Text>
              <View style={styles.durationButtonsRow}>
                {durationOptions.map((dur) => {
                  const isActive = dur === selectedDuration;
                  return (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        styles.durationButton,
                        isActive && styles.durationButtonActive,
                      ]}
                      onPress={() => setSelectedDuration(dur)}
                    >
                      <Text
                        variant="labelSm"
                        color={isActive ? colors.onPrimaryContainer : colors.onSurface}
                      >
                        {dur} min
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Card>

        {/* Conflict Error Callout */}
        {conflictError ? (
          <Card style={styles.conflictCard}>
            <Icon name="alert-triangle" size={22} color={colors.danger} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleS" color={colors.danger}>
                Slot Conflict
              </Text>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                {conflictError}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text variant="titleS" color={colors.primary}>
            AVAILABLE VENUES
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {pitches ? `${pitches.length} venue(s) matching criteria` : "Searching pitches..."}
          </Text>
        </View>

        {/* Pitches List */}
        {pitchesLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primaryContainer} />
            <Text variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
              Finding available pitches in your area...
            </Text>
          </View>
        ) : !pitches || pitches.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="map-pin" size={32} color={colors.outline} />
            <Text variant="titleS" color={colors.primary} style={{ marginTop: 8 }}>
              No Matching Pitches Found
            </Text>
            <Text variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: "center", marginTop: 4 }}>
              No active pitches match the agreed format ({formatPitchFormat(challenge.format)}) within {challenge.radiusKm} km of {formatApproximateArea(challenge.approximateArea)}.
            </Text>
          </Card>
        ) : (
          pitches.map((pitch) => (
            <PitchSlotItem
              key={pitch.id}
              pitch={pitch}
              challenge={challenge}
              durationMinutes={selectedDuration}
              onSelectSlot={(slot) => handleOpenConfirm(pitch, slot)}
            />
          ))
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      {selectedPitch && selectedSlot ? (
        <Modal
          visible={isConfirmModalOpen}
          animationType="slide"
          transparent
          onRequestClose={handleCloseConfirm}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text variant="titleM" color={colors.primary}>
                  Confirm Pitch Booking
                </Text>
                <TouchableOpacity onPress={handleCloseConfirm} disabled={isSubmitting}>
                  <Icon name="x" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {conflictError ? (
                  <View style={styles.modalConflictBanner}>
                    <Icon name="alert-triangle" size={18} color={colors.danger} />
                    <Text variant="caption" color={colors.danger} style={{ flex: 1 }}>
                      {conflictError}
                    </Text>
                  </View>
                ) : null}

                {/* Matchup */}
                <Card style={styles.modalMatchupCard}>
                  <Text variant="overline" color={colors.primaryContainer}>
                    SCHEDULED TEAMS
                  </Text>
                  <Text variant="titleS" color={colors.primary} style={{ marginTop: 2 }}>
                    {challenge.challengerTeam.name} vs {challenge.opponentTeam.name}
                  </Text>
                </Card>

                {/* Pitch Details */}
                <Card style={styles.modalPitchCard}>
                  <View style={styles.modalPitchRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleS" color={colors.primary}>
                        {selectedPitch.name}
                      </Text>
                      <Text variant="caption" color={colors.onSurfaceVariant}>
                        {selectedPitch.address ?? selectedPitch.city}
                      </Text>
                    </View>
                    <Badge label={formatPitchSurface(selectedPitch.surface)} tone="neutral" />
                  </View>

                  <View style={styles.comparisonGrid}>
                    <View style={styles.comparisonItem}>
                      <Text variant="labelSm" color={colors.onSurfaceVariant}>
                        PITCH FORMAT
                      </Text>
                      <Text variant="bodySm" color={colors.primary}>
                        {formatPitchFormat(selectedPitch.format ?? selectedPitch.size ?? "FIVE_A_SIDE")} ✓
                      </Text>
                    </View>

                    <View style={styles.comparisonItem}>
                      <Text variant="labelSm" color={colors.onSurfaceVariant}>
                        DISTANCE
                      </Text>
                      <Text variant="bodySm" color={colors.primary}>
                        {selectedPitch.lat != null && selectedPitch.lng != null
                          ? `${formatDistance(
                              calculateDistanceKm(
                                challenge.approximateArea.lat,
                                challenge.approximateArea.lng,
                                selectedPitch.lat,
                                selectedPitch.lng,
                              ),
                            )} ✓`
                          : "Verified ✓"}
                      </Text>
                    </View>

                    <View style={styles.comparisonItem}>
                      <Text variant="labelSm" color={colors.onSurfaceVariant}>
                        KICKOFF TIME
                      </Text>
                      <Text variant="bodySm" color={colors.primary}>
                        {formatAlgiersTimeRange(selectedSlot.startAt, selectedSlot.endAt)}
                      </Text>
                    </View>

                    <View style={styles.comparisonItem}>
                      <Text variant="labelSm" color={colors.onSurfaceVariant}>
                        TOTAL DZD PRICE
                      </Text>
                      <Text variant="titleS" color={colors.primaryContainer}>
                        {formatPitchPrice({
                          amountMinor: Math.round(
                            (selectedPitch.hourlyRate.amountMinor * selectedDuration) / 60,
                          ),
                          currency: "DZD",
                        })}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Important Notice */}
                <Card style={styles.modalNoticeCard}>
                  <Icon name="info" size={16} color={colors.primaryContainer} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="labelSm" color={colors.primaryContainer}>
                      OFFLINE VENUE SETTLEMENT
                    </Text>
                    <Text variant="caption" color={colors.onSurfaceVariant}>
                      Payment is settled in cash directly at the venue upon arrival. The pitch owner has a deadline to confirm or decline this booking.
                    </Text>
                  </View>
                </Card>
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={handleCloseConfirm}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                />
                <Button
                  label={isSubmitting ? "Requesting..." : "Send Request"}
                  variant="primary"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  onPress={handleConfirmBooking}
                  icon={
                    !isSubmitting ? (
                      <Icon name="check" size={18} color={colors.onPrimary} />
                    ) : undefined
                  }
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

interface PitchSlotItemProps {
  pitch: Pitch;
  challenge: MatchChallengeDetail;
  durationMinutes: number;
  onSelectSlot: (slot: AvailableSlot) => void;
}

function PitchSlotItem({
  pitch,
  challenge,
  durationMinutes,
  onSelectSlot,
}: PitchSlotItemProps) {
  // Query exact available slots in the agreed window for this pitch
  const {
    data: slots,
    isLoading,
  } = useQuery<AvailableSlot[]>({
    queryKey: [
      "pitch-slots-for-challenge",
      pitch.id,
      challenge.startAt,
      challenge.endAt,
      durationMinutes,
    ],
    queryFn: () =>
      api.getAvailableSlots(pitch.id, {
        from: challenge.startAt,
        to: challenge.endAt,
        durationMinutes,
      }),
  });

  const distanceKm =
    pitch.lat != null && pitch.lng != null
      ? calculateDistanceKm(
          challenge.approximateArea.lat,
          challenge.approximateArea.lng,
          pitch.lat,
          pitch.lng,
        )
      : null;

  const slotPriceMinor = Math.round(
    (pitch.hourlyRate.amountMinor * durationMinutes) / 60,
  );
  const formattedSlotPrice = formatPitchPrice({
    amountMinor: slotPriceMinor,
    currency: "DZD",
  });

  return (
    <Card style={styles.pitchCard}>
      {/* Pitch Header */}
      <View style={styles.pitchHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text variant="titleS" color={colors.primary}>
            {pitch.name}
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant} numberOfLines={1}>
            {pitch.address ?? pitch.city}
          </Text>
        </View>
        <Badge label={formatPitchFormat(pitch.format ?? pitch.size ?? "FIVE_A_SIDE")} tone="brand" />
      </View>

      {/* Meta tags */}
      <View style={styles.pitchMetaRow}>
        {distanceKm != null ? (
          <Text variant="caption" color={colors.onSurfaceVariant}>
            📍 {formatDistance(distanceKm)} away (limit {challenge.radiusKm} km)
          </Text>
        ) : null}
        <Text variant="caption" color={colors.onSurfaceVariant}>
          🌿 {formatPitchSurface(pitch.surface)}
        </Text>
        <Text variant="caption" color={colors.primaryContainer} style={{ fontWeight: "700" }}>
          💵 {formattedSlotPrice} / {durationMinutes}m
        </Text>
      </View>

      {/* Available Slots */}
      <View style={styles.slotsSection}>
        <Text variant="labelSm" color={colors.onSurfaceVariant} style={{ marginBottom: 6 }}>
          AVAILABLE SLOTS IN WINDOW:
        </Text>

        {isLoading ? (
          <View style={styles.slotsLoading}>
            <ActivityIndicator size="small" color={colors.primaryContainer} />
            <Text variant="caption" color={colors.onSurfaceVariant} style={{ marginLeft: 6 }}>
              Checking slot availability...
            </Text>
          </View>
        ) : !slots || slots.length === 0 ? (
          <Text variant="caption" color={colors.loss} style={{ fontStyle: "italic" }}>
            No slots open in the agreed window. Try another duration or venue.
          </Text>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((slot, idx) => (
              <TouchableOpacity
                key={`${slot.startAt}-${idx}`}
                style={styles.slotChip}
                onPress={() => onSelectSlot(slot)}
              >
                <Icon name="clock" size={14} color={colors.primaryContainer} />
                <Text variant="labelSm" color={colors.primary}>
                  {formatAlgiersTime(slot.startAt)} – {formatAlgiersTime(slot.endAt)}
                </Text>
                <Text variant="caption" color={colors.primaryContainer} style={{ fontWeight: "700" }}>
                  {formattedSlotPrice}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.surface,
  },
  errorCard: {
    alignItems: "center",
    padding: 24,
    gap: 8,
    width: "100%",
    maxWidth: 360,
  },
  conditionsCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(195, 244, 0, 0.2)",
  },
  conditionsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 8,
  },
  conditionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  durationSelectorContainer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  durationButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  durationButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  durationButtonActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  conflictCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 84, 73, 0.12)",
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 4,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.surfaceContainer,
  },
  pitchCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  pitchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pitchMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    paddingBottom: 8,
  },
  slotsSection: {
    gap: 6,
  },
  slotsLoading: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: "rgba(195, 244, 0, 0.3)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderTopColor: "rgba(195, 244, 0, 0.3)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalBody: {
    gap: 12,
  },
  modalConflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 84, 73, 0.15)",
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalMatchupCard: {
    backgroundColor: colors.surfaceContainerHigh,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalPitchCard: {
    backgroundColor: colors.surfaceContainerHigh,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 10,
  },
  modalPitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  comparisonGrid: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 8,
    gap: 8,
  },
  comparisonItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalNoticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(195, 244, 0, 0.08)",
    borderColor: "rgba(195, 244, 0, 0.2)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
});
