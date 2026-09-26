import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { AvailableSlot, Pitch } from "@footconnect/shared";
import { formatPitchPrice } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Badge, Button, Card, Icon, Text } from "../ui";
import { api } from "../../lib/api";
import { calculateDistanceKm, formatDistance } from "../../lib/geo";
import {
  formatAlgiersDate,
  formatPitchFormat,
  formatPitchSurface,
  getAlgiersDayBoundariesUtc,
  getUpcomingDays,
  type DayOption,
} from "../../lib/format-pitch";
import { PitchSlotCard } from "./PitchSlotCard";

export interface PitchDetailModalProps {
  pitch: Pitch | null;
  visible: boolean;
  onClose: () => void;
  userLat?: number | null;
  userLng?: number | null;
}

const DURATION_OPTIONS = [
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
  { label: "120 min", value: 120 },
] as const;

export function PitchDetailModal({
  pitch,
  visible,
  onClose,
  userLat,
  userLng,
}: PitchDetailModalProps) {
  const upcomingDays = useMemo(() => getUpcomingDays(7), []);
  const [selectedDay, setSelectedDay] = useState<DayOption>(upcomingDays[0]!);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  // Compute UTC query boundaries for the selected Algiers calendar day
  const queryBoundaries = useMemo(() => {
    return getAlgiersDayBoundariesUtc(selectedDay.date);
  }, [selectedDay]);

  // Query exact inventory
  const {
    data: slots,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<AvailableSlot[]>({
    queryKey: [
      "pitch-available-slots",
      pitch?.id,
      selectedDay.dateKey,
      durationMinutes,
    ],
    queryFn: () => {
      if (!pitch) return Promise.resolve([]);
      return api.getAvailableSlots(pitch.id, {
        from: queryBoundaries.from,
        to: queryBoundaries.to,
        durationMinutes,
      });
    },
    enabled: !!pitch && visible,
  });

  if (!pitch) return null;

  const hasCoordinates =
    userLat != null &&
    userLng != null &&
    pitch.lat != null &&
    pitch.lng != null;

  const distanceKm = hasCoordinates
    ? calculateDistanceKm(userLat, userLng, pitch.lat, pitch.lng)
    : null;

  const formatLabel = formatPitchFormat(pitch.format);
  const surfaceLabel = formatPitchSurface(pitch.surface);
  const priceDisplay = `${formatPitchPrice(pitch.hourlyRate)}/h`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text
                variant="titleM"
                color={colors.primary}
                numberOfLines={1}
                allowFontScaling={true}
              >
                {pitch.name}
              </Text>
              <Text
                variant="labelSm"
                color={colors.onSurfaceVariant}
                numberOfLines={1}
                allowFontScaling={true}
              >
                📍 {pitch.address}, {pitch.city}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close pitch details"
            >
              <Icon name="x" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Quick Badges */}
          <View style={styles.badgesContainer}>
            <Badge label={formatLabel} tone="brand" />
            <Badge label={surfaceLabel} tone="neutral" />
            <Badge label={priceDisplay} tone="win" />
            {distanceKm != null && (
              <View style={styles.distanceBadge}>
                <Icon name="map-pin" size={12} color={colors.primaryContainer} />
                <Text
                  variant="labelXs"
                  color={colors.onSurface}
                  allowFontScaling={true}
                >
                  {formatDistance(distanceKm)}
                </Text>
              </View>
            )}
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Date Selector */}
            <View style={styles.sectionHeader}>
              <Icon name="calendar" size={16} color={colors.outline} />
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                SELECT DATE (ALGIERS TIME):
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateSelectorContent}
            >
              {upcomingDays.map((day) => {
                const isActive = day.dateKey === selectedDay.dateKey;
                return (
                  <TouchableOpacity
                    key={day.dateKey}
                    onPress={() => setSelectedDay(day)}
                    style={[styles.dateChip, isActive && styles.dateChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select date ${day.dayLabel}, ${day.dateLabel}`}
                    activeOpacity={0.7}
                  >
                    <Text
                      variant="labelXs"
                      color={isActive ? colors.primaryContainer : colors.onSurfaceVariant}
                      style={{ fontWeight: isActive ? "700" : "500" }}
                      allowFontScaling={true}
                    >
                      {day.dayLabel}
                    </Text>
                    <Text
                      variant="bodySm"
                      color={isActive ? colors.primary : colors.onSurface}
                      style={{ fontWeight: isActive ? "700" : "500" }}
                      allowFontScaling={true}
                    >
                      {day.dateLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Duration Selector */}
            <View style={styles.durationRow}>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                MATCH DURATION:
              </Text>
              <View style={styles.durationOptions}>
                {DURATION_OPTIONS.map((opt) => {
                  const isActive = opt.value === durationMinutes;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setDurationMinutes(opt.value)}
                      style={[
                        styles.durationChip,
                        isActive && styles.durationChipActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        variant="labelXs"
                        color={
                          isActive
                            ? colors.primaryContainer
                            : colors.onSurfaceVariant
                        }
                        style={{ fontWeight: isActive ? "700" : "500" }}
                        allowFontScaling={true}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Slots / Inventory Section */}
            <View style={styles.inventorySection}>
              <View style={styles.inventoryHeader}>
                <Text variant="overline" color={colors.primary}>
                  EXACT INVENTORY • {formatAlgiersDate(selectedDay.date)}
                </Text>
                {isFetching && !isLoading && (
                  <ActivityIndicator size="small" color={colors.primaryContainer} />
                )}
              </View>

              {/* Loading State */}
              {isLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={colors.primaryContainer} />
                  <Text
                    variant="caption"
                    color={colors.textSecondary}
                    style={styles.statusText}
                    allowFontScaling={true}
                  >
                    Checking real-time slot inventory...
                  </Text>
                </View>
              ) : isError ? (
                /* Error / Retry State */
                <Card style={styles.errorCard}>
                  <View style={styles.stateContent}>
                    <Icon name="alert-triangle" size={28} color={colors.loss} />
                    <Text
                      variant="titleS"
                      color={colors.loss}
                      style={styles.stateTitle}
                      allowFontScaling={true}
                    >
                      Unable to Load Inventory
                    </Text>
                    <Text
                      variant="caption"
                      color={colors.textSecondary}
                      style={styles.stateDescription}
                      allowFontScaling={true}
                    >
                      Could not retrieve slots from the server. Please check your network connection.
                    </Text>
                    <Button
                      label="Retry"
                      variant="secondary"
                      size="sm"
                      onPress={() => refetch()}
                      style={styles.retryBtn}
                    />
                  </View>
                </Card>
              ) : !slots || slots.length === 0 ? (
                /* Closure-Safe Empty State */
                <Card style={styles.emptyCard}>
                  <View style={styles.stateContent}>
                    <Icon name="calendar" size={32} color={colors.outline} />
                    <Text
                      variant="titleS"
                      color={colors.primary}
                      style={styles.stateTitle}
                      allowFontScaling={true}
                    >
                      No Available Slots
                    </Text>
                    <Text
                      variant="caption"
                      color={colors.textSecondary}
                      style={styles.stateDescription}
                      allowFontScaling={true}
                    >
                      No bookable slots found for this date. The pitch may be closed for scheduled maintenance, outside active hours, or fully booked.
                    </Text>
                  </View>
                </Card>
              ) : (
                /* Available Slots Grid */
                <View style={styles.slotsList}>
                  {slots.map((slot) => (
                    <PitchSlotCard
                      key={`${slot.startAt}-${slot.endAt}`}
                      slot={slot}
                    />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Discovery-only footer */}
          <View style={styles.footer}>
            <Button
              label="Close"
              variant="secondary"
              onPress={onClose}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.layer1,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  badgesContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  scrollArea: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateSelectorContent: {
    gap: spacing.xs + 2,
    paddingVertical: 4,
  },
  dateChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    minWidth: 72,
  },
  dateChipActive: {
    backgroundColor: "rgba(195, 244, 0, 0.12)",
    borderColor: colors.primaryContainer,
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  durationOptions: {
    flexDirection: "row",
    gap: 6,
  },
  durationChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: "transparent",
  },
  durationChipActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: "rgba(195, 244, 0, 0.12)",
  },
  inventorySection: {
    gap: spacing.sm,
  },
  inventoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  statusText: {
    textAlign: "center",
  },
  errorCard: {
    padding: spacing.md,
    borderColor: "rgba(255, 77, 77, 0.3)",
  },
  emptyCard: {
    padding: spacing.md,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  stateContent: {
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  stateTitle: {
    marginTop: 4,
    textAlign: "center",
  },
  stateDescription: {
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  retryBtn: {
    marginTop: spacing.sm,
    minWidth: 100,
  },
  slotsList: {
    gap: 4,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
});
