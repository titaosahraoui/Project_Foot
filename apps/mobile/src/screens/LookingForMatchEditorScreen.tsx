import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  MatchFormat,
  OpponentRecommendation,
  PaginatedRecommendations,
  TeamAvailability,
  TeamDetail,
} from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Badge, Button, Card, Icon, Input, Text } from "../components/ui";
import {
  CaptainOnlyNotice,
  RecommendationCard,
} from "../components/matchmaking";
import {
  ALGIERS_OFFSET_MS,
  MIN_LEAD_TIME_HOURS,
  algiersToUtcIso,
  formatAlgiersTimeRange,
  getAlgiersNow,
  validateAvailabilityInput,
} from "../lib/algiers-time";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import type { PlayStackParamList } from "../navigation";
import { fontFamily } from "../theme/fonts";

type Props = NativeStackScreenProps<PlayStackParamList, "LookingForMatchEditor">;

const FORMAT_OPTIONS: { label: string; value: MatchFormat }[] = [
  { label: "5v5", value: "FIVE_A_SIDE" },
  { label: "7v7", value: "SEVEN_A_SIDE" },
  { label: "11v11", value: "ELEVEN_A_SIDE" },
];

const DURATION_OPTIONS = [60, 90, 120, 180, 240];
const RADIUS_OPTIONS = [5, 10, 15, 25, 50];
const ELO_TOLERANCE_OPTIONS = [50, 100, 150, 200, 300];

export function LookingForMatchEditorScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch user's teams
  const { data: myTeams, isLoading: teamsLoading } = useQuery<TeamDetail[]>({
    queryKey: ["myTeams"],
    queryFn: () => api.getMyTeams(),
  });

  // Filter to active teams where user is captain
  const captainTeams = useMemo(() => {
    return (myTeams ?? []).filter((t) => {
      const m = t.members.find((member) => member.userId === user?.id);
      return (
        t.status === "ACTIVE" &&
        (m?.teamRole === "CAPTAIN" || m?.role === "CAPTAIN")
      );
    });
  }, [myTeams, user?.id]);

  const isCaptain = captainTeams.length > 0;

  // Selected Team ID (default to route param or first captained team)
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    return route.params?.teamId ?? captainTeams[0]?.id ?? "";
  });

  // If captainTeams loads and selectedTeamId is empty, initialize it
  if (!selectedTeamId && captainTeams.length > 0) {
    setSelectedTeamId(captainTeams[0].id);
  }

  const selectedTeam = captainTeams.find((t) => t.id === selectedTeamId);

  // Form State in Algiers Local Time (UTC+1)
  const defaultStart = useMemo(() => {
    // Current Algiers time + 7 hours (guarantees >= 6h lead time)
    const algiersFutureMs = Date.now() + ALGIERS_OFFSET_MS + 7 * 60 * 60 * 1000;
    const d = new Date(algiersFutureMs);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hours = String(d.getUTCHours()).padStart(2, "0");
    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hours}:00`,
    };
  }, []);

  const [format, setFormat] = useState<MatchFormat>("FIVE_A_SIDE");
  const [dateStr, setDateStr] = useState<string>(defaultStart.dateStr);
  const [timeStr, setTimeStr] = useState<string>(defaultStart.timeStr);
  const [durationMinutes, setDurationMinutes] = useState<number>(90);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [eloTolerance, setEloTolerance] = useState<number>(150);
  const [message, setMessage] = useState<string>("");

  // Validation & Error states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Success state with newly created availability and recommendations
  const [createdAvailability, setCreatedAvailability] =
    useState<TeamAvailability | null>(null);
  const [createdRecs, setCreatedRecs] = useState<OpponentRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Computed preview times
  const previewTimes = useMemo(() => {
    try {
      const startUtc = algiersToUtcIso(dateStr, timeStr);
      const endUtc = new Date(
        new Date(startUtc).getTime() + durationMinutes * 60 * 1000,
      ).toISOString();
      return {
        valid: true,
        startUtc,
        endUtc,
        algiersRange: formatAlgiersTimeRange(startUtc, endUtc),
      };
    } catch {
      return { valid: false };
    }
  }, [dateStr, timeStr, durationMinutes]);

  // Create Availability Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null);

      // Validate inputs
      const validation = validateAvailabilityInput({
        teamId: selectedTeamId,
        isCaptain: isCaptain && !!selectedTeam,
        dateStr,
        timeStr,
        durationMinutes,
        radiusKm,
        eloTolerance,
        message: message.trim() || undefined,
      });

      if (!validation.valid) {
        setFieldErrors(validation.errors);
        throw new Error("Please correct the form errors before submitting");
      }
      setFieldErrors({});

      // Origin coordinates: Team location > User location > Algiers Center
      const originLat = selectedTeam?.lat ?? user?.lat ?? 36.7538;
      const originLng = selectedTeam?.lng ?? user?.lng ?? 3.0588;

      // Single UTC conversion
      const created = await api.createAvailability({
        teamId: selectedTeamId,
        format,
        startAt: validation.startUtcIso!,
        endAt: validation.endUtcIso!,
        origin: { lat: originLat, lng: originLng },
        radiusKm,
        eloTolerance,
        message: message.trim() || undefined,
      });

      return created;
    },
    onSuccess: async (created) => {
      void queryClient.invalidateQueries({ queryKey: ["myAvailability"] });
      setCreatedAvailability(created);

      // Explicit instruction: "Do not request recommendations until the availability create response succeeds."
      setLoadingRecs(true);
      try {
        const recs: PaginatedRecommendations = await api.getRecommendations(
          created.id,
        );
        setCreatedRecs(recs.items);
      } catch (err: any) {
        // Recommendations fetch is optional / post-create preview
        setCreatedRecs([]);
      } finally {
        setLoadingRecs(false);
      }
    },
    onError: (err: any) => {
      setSubmitError(
        err?.message ?? "Failed to create match availability. Please try again.",
      );
    },
  });

  // Handle Quick Date Chips
  const setQuickDate = (daysAhead: number) => {
    const algiersEpoch =
      Date.now() + ALGIERS_OFFSET_MS + daysAhead * 24 * 60 * 60 * 1000;
    const d = new Date(algiersEpoch);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    setDateStr(`${y}-${m}-${day}`);
    setFieldErrors((prev) => ({ ...prev, startAt: "" }));
  };

  // If user is not captain of any squad, display read-only Captain notice
  if (!teamsLoading && !isCaptain) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <CaptainOnlyNotice style={{ marginBottom: spacing.md }} />
          <Card style={styles.card}>
            <Text variant="titleS" color={colors.primary}>
              Squad Member Access
            </Text>
            <Text variant="body" color={colors.textSecondary} style={{ marginTop: 4 }}>
              Only squad captains can schedule or publish looking-for-match availability. You can view all squad match windows from the match list.
            </Text>
            <Button
              label="View Squad Availabilities"
              onPress={() => navigation.navigate("LookingForMatchList")}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </ScrollView>
      </View>
    );
  }

  // Success view once availability is created
  if (createdAvailability) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.successCard}>
            <Icon name="check" size={40} color={colors.primaryContainer} />
            <Text variant="headlineMd" color={colors.primary}>
              MATCH WINDOW PUBLISHED
            </Text>
            <Text variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
              Your availability is now live. Other teams in Algiers can match with you.
            </Text>

            <View style={styles.previewBox}>
              <Text variant="labelSm" color={colors.primary}>
                {selectedTeam?.name} · {format === "FIVE_A_SIDE" ? "5v5" : format === "SEVEN_A_SIDE" ? "7v7" : "11v11"}
              </Text>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                {formatAlgiersTimeRange(
                  createdAvailability.startAt,
                  createdAvailability.endAt,
                )}
              </Text>
              <Text variant="caption" color={colors.outline}>
                Radius: {createdAvailability.radiusKm} km · ELO ±{createdAvailability.eloTolerance}
              </Text>
            </View>

            <Button
              label="Explore Matching Opponents"
              onPress={() =>
                navigation.navigate("RecommendedOpponents", {
                  availabilityId: createdAvailability.id,
                  teamName: selectedTeam?.name,
                  teamId: selectedTeamId,
                })
              }
              style={{ marginTop: spacing.sm }}
            />
            <Button
              label="Back to Availability List"
              variant="secondary"
              onPress={() => navigation.navigate("LookingForMatchList")}
              style={{ marginTop: spacing.xs }}
            />
          </Card>

          {/* Recommended Opponents Preview (No challenge actions) */}
          <View style={styles.recsSection}>
            <Text variant="titleS" color={colors.primary}>
              MATCHING OPPONENTS
            </Text>

            {loadingRecs ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primaryContainer} size="small" />
                <Text variant="caption" color={colors.textSecondary}>
                  Finding matching opponents...
                </Text>
              </View>
            ) : createdRecs.length > 0 ? (
              createdRecs.map((rec) => (
                <RecommendationCard
                  key={rec.availabilityId}
                  recommendation={rec}
                />
              ))
            ) : (
              <Card style={{ padding: spacing.md, alignItems: "center" }}>
                <Text variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>
                  No matching opponents currently found within your criteria. You will be matched when an opponent becomes available.
                </Text>
              </Card>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Error banner with retry if submission failed */}
        {submitError ? (
          <Card style={styles.errorBanner}>
            <Icon name="alert-triangle" size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" color={colors.danger}>
                {submitError}
              </Text>
            </View>
            <Button
              label="Retry"
              size="sm"
              variant="ghost"
              onPress={() => createMutation.mutate()}
            />
          </Card>
        ) : null}

        {/* 1. Team Selector */}
        <Card style={styles.card}>
          <Text variant="labelSm" color={colors.onSurfaceVariant}>
            SELECT SQUAD (CAPTAIN ONLY)
          </Text>
          <View style={styles.chipRow}>
            {captainTeams.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.chip,
                  selectedTeamId === t.id && styles.chipActive,
                ]}
                onPress={() => {
                  setSelectedTeamId(t.id);
                  setFieldErrors((prev) => ({ ...prev, teamId: "" }));
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedTeamId === t.id && styles.chipTextActive,
                  ]}
                >
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {fieldErrors.teamId ? (
            <Text variant="caption" color={colors.danger}>
              {fieldErrors.teamId}
            </Text>
          ) : null}
        </Card>

        {/* 2. Format Selector */}
        <Card style={styles.card}>
          <Text variant="labelSm" color={colors.onSurfaceVariant}>
            MATCH FORMAT
          </Text>
          <View style={styles.chipRow}>
            {FORMAT_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, format === f.value && styles.chipActive]}
                onPress={() => setFormat(f.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    format === f.value && styles.chipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* 3. Local Algiers Date & Time */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text variant="labelSm" color={colors.onSurfaceVariant}>
              LOCAL ALGIERS TIME (UTC+1)
            </Text>
            <Badge label={`MIN ${MIN_LEAD_TIME_HOURS}H LEAD TIME`} tone="neutral" />
          </View>

          {/* Quick Date Chips */}
          <View style={styles.quickDateRow}>
            <TouchableOpacity
              style={styles.quickDateBtn}
              onPress={() => setQuickDate(0)}
            >
              <Text style={styles.quickDateText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickDateBtn}
              onPress={() => setQuickDate(1)}
            >
              <Text style={styles.quickDateText}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickDateBtn}
              onPress={() => setQuickDate(2)}
            >
              <Text style={styles.quickDateText}>In 2 Days</Text>
            </TouchableOpacity>
          </View>

          {/* Date & Start Time Inputs */}
          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Date (YYYY-MM-DD)"
                value={dateStr}
                onChangeText={(val) => {
                  setDateStr(val);
                  setFieldErrors((prev) => ({ ...prev, startAt: "" }));
                }}
                placeholder="2026-10-05"
                error={fieldErrors.startAt}
              />
            </View>
            <View style={{ width: 130 }}>
              <Input
                label="Start Time (HH:mm)"
                value={timeStr}
                onChangeText={(val) => {
                  setTimeStr(val);
                  setFieldErrors((prev) => ({ ...prev, startAt: "" }));
                }}
                placeholder="19:00"
              />
            </View>
          </View>

          {/* Duration Chips */}
          <Text variant="labelXs" color={colors.onSurfaceVariant} style={{ marginTop: 4 }}>
            DURATION:
          </Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, durationMinutes === d && styles.chipActive]}
                onPress={() => setDurationMinutes(d)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    durationMinutes === d && styles.chipTextActive,
                  ]}
                >
                  {d}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {fieldErrors.durationMinutes ? (
            <Text variant="caption" color={colors.danger}>
              {fieldErrors.durationMinutes}
            </Text>
          ) : null}

          {/* Real-time Algiers & UTC Confirmation */}
          {previewTimes.valid ? (
            <View style={styles.previewBox}>
              <View style={styles.timePreviewRow}>
                <Icon name="clock" size={14} color={colors.primaryContainer} />
                <Text variant="labelSm" color={colors.primaryContainer}>
                  {previewTimes.algiersRange}
                </Text>
              </View>
              <Text variant="caption" color={colors.onSurfaceVariant}>
                Stored in UTC: {new Date(previewTimes.startUtc!).toISOString().slice(11, 16)} – {new Date(previewTimes.endUtc!).toISOString().slice(11, 16)} UTC
              </Text>
            </View>
          ) : null}
        </Card>

        {/* 4. Radius & Elo Tolerance */}
        <Card style={styles.card}>
          <Text variant="labelSm" color={colors.onSurfaceVariant}>
            SEARCH RADIUS (KM)
          </Text>
          <View style={styles.chipRow}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, radiusKm === r && styles.chipActive]}
                onPress={() => {
                  setRadiusKm(r);
                  setFieldErrors((prev) => ({ ...prev, radiusKm: "" }));
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    radiusKm === r && styles.chipTextActive,
                  ]}
                >
                  {r} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {fieldErrors.radiusKm ? (
            <Text variant="caption" color={colors.danger}>
              {fieldErrors.radiusKm}
            </Text>
          ) : null}

          <Text variant="labelSm" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
            ELO TOLERANCE
          </Text>
          <View style={styles.chipRow}>
            {ELO_TOLERANCE_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, eloTolerance === t && styles.chipActive]}
                onPress={() => {
                  setEloTolerance(t);
                  setFieldErrors((prev) => ({ ...prev, eloTolerance: "" }));
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    eloTolerance === t && styles.chipTextActive,
                  ]}
                >
                  ±{t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {fieldErrors.eloTolerance ? (
            <Text variant="caption" color={colors.danger}>
              {fieldErrors.eloTolerance}
            </Text>
          ) : null}
        </Card>

        {/* 5. Message Note */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text variant="labelSm" color={colors.onSurfaceVariant}>
              MATCH NOTE / MESSAGE (OPTIONAL)
            </Text>
            <Text variant="caption" color={message.length > 280 ? colors.danger : colors.outline}>
              {message.length} / 280
            </Text>
          </View>
          <Input
            value={message}
            onChangeText={(val) => {
              setMessage(val);
              setFieldErrors((prev) => ({ ...prev, message: "" }));
            }}
            placeholder="e.g. Competitive friendly, turf pitch, referee provided"
            multiline
            style={{ height: 70 }}
            error={fieldErrors.message}
          />
        </Card>

        {/* Submit Button */}
        <Button
          label="Publish Availability Window"
          loading={createMutation.isPending}
          onPress={() => createMutation.mutate()}
          style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    padding: spacing.gutter,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: "rgba(195, 244, 0, 0.12)",
  },
  chipText: {
    fontFamily: fontFamily.label,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: colors.primaryContainer,
    fontWeight: "700",
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickDateBtn: {
    backgroundColor: colors.layer0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  quickDateText: {
    fontSize: 11,
    color: colors.onSurface,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  previewBox: {
    backgroundColor: colors.layer0,
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryContainer,
  },
  timePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderColor: colors.danger,
    borderWidth: 1,
    backgroundColor: "rgba(255, 68, 68, 0.08)",
  },
  successCard: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  recsSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
});
