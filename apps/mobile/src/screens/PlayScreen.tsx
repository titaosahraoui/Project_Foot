import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { Pitch } from "@footconnect/shared";
import { colors, spacing, radii } from "@footconnect/ui";
import {
  Badge,
  Button,
  Card,
  Icon,
  Text,
  TrustSignalRing,
} from "../components/ui";
import { PitchCard, PitchDetailModal } from "../components/pitch";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { fontFamily } from "../theme/fonts";

const FORMATS = ["5v5", "7v7", "11v11"] as const;
const DATES = ["Today", "Tomorrow", "This Week"] as const;

export function PlayScreen() {
  const { user } = useAuth();
  const [selectedFormat, setSelectedFormat] = useState<string>("5v5");
  const [selectedDate, setSelectedDate] = useState<string>("Today");
  const [activeTab, setActiveTab] = useState<"matches" | "pitches">("matches");
  const [selectedPitch, setSelectedPitch] = useState<Pitch | null>(null);

  const {
    data: pitches,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Pitch[]>({
    queryKey: ["pitches-discovery"],
    queryFn: () => api.getPitches(),
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top App Bar Header */}
      <View style={styles.headerBar}>
        <Text variant="headlineLgMobile" color={colors.primaryContainer} style={styles.headerTitle}>
          FIND MATCH
        </Text>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
          <Icon name="bell" color={colors.onSurfaceVariant} size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Bar */}
        <Card style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <Icon name="sliders" color={colors.outline} size={16} />
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                FILTERS:
              </Text>
            </View>
            <View style={styles.distanceBadge}>
              <Icon name="map-pin" color={colors.outline} size={14} />
              <Text style={styles.distanceText}>MAX 5km</Text>
            </View>
          </View>

          {/* Format selector */}
          <View style={styles.chipRow}>
            {FORMATS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.ghostChip, selectedFormat === f && styles.ghostChipActive]}
                onPress={() => setSelectedFormat(f)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedFormat === f && { color: colors.primaryContainer, fontWeight: "700" },
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date selector & Elo range */}
          <View style={styles.dateAndEloRow}>
            <View style={styles.dateSelector}>
              {DATES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.ghostDateChip, selectedDate === d && styles.ghostDateChipActive]}
                  onPress={() => setSelectedDate(d)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      selectedDate === d && { color: colors.primary, fontWeight: "600" },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.eloRangeBox}>
              <Text variant="labelXs" color={colors.onSurfaceVariant}>
                ELO:
              </Text>
              <Text style={styles.eloRangeText}>1200 - 1400</Text>
            </View>
          </View>
        </Card>

        {/* Tab switcher: Matches vs Pitches */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "matches" && styles.tabButtonActive]}
            onPress={() => setActiveTab("matches")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "matches" && { color: colors.primaryContainer, fontWeight: "700" },
              ]}
            >
              RECOMMENDED MATCHES
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "pitches" && styles.tabButtonActive]}
            onPress={() => setActiveTab("pitches")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "pitches" && { color: colors.primaryContainer, fontWeight: "700" },
              ]}
            >
              PITCHES & SLOTS
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "matches" ? (
          <View style={styles.matchList}>
            {/* Match 1: FC HYDRA (Elite Match) */}
            <Card elite glow padded style={styles.matchChallengeCard}>
              <View style={styles.matchHeaderRow}>
                <View>
                  <Text variant="headlineMd" color={colors.primary}>
                    FC HYDRA
                  </Text>
                  <Text variant="labelSm" color={colors.secondaryFixed}>
                    ELITE MATCH
                  </Text>
                </View>
                <Badge label="OPEN CHALLENGE" tone="win" />
              </View>

              <View style={styles.matchQualityRow}>
                <View style={styles.qualityLeft}>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    MATCH QUALITY
                  </Text>
                  <TrustSignalRing percentage={96} size={42} color={colors.primaryContainer} />
                </View>
                <View style={styles.qualityRight}>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    AVG ELO
                  </Text>
                  <Text variant="statsXl" color={colors.primaryContainer}>
                    1385
                  </Text>
                </View>
              </View>

              <View style={styles.matchFooterRow}>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Icon name="map-pin" color={colors.onSurfaceVariant} size={14} />
                    <Text variant="labelSm" color={colors.onSurface}>
                      2.0 km
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="shield" color={colors.secondaryFixed} size={14} />
                    <Text variant="labelSm" color={colors.secondaryFixed}>
                      100% REP
                    </Text>
                  </View>
                </View>
                <Button label="CHALLENGE" size="sm" style={{ width: 120 }} />
              </View>
            </Card>

            {/* Match 2: ALGIERS SHARKS (Silver Tier Border) */}
            <Card tierBorderColor="#C0C0C0" padded style={styles.matchChallengeCard}>
              <View style={styles.matchHeaderRow}>
                <View>
                  <Text variant="headlineMd" color={colors.primary}>
                    ALGIERS SHARKS
                  </Text>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    HIGH SKILL MATCH
                  </Text>
                </View>
                <Badge label="7V7 ONLY" tone="neutral" />
              </View>

              <View style={styles.matchQualityRow}>
                <View style={styles.qualityLeft}>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    MATCH QUALITY
                  </Text>
                  <TrustSignalRing percentage={89} size={42} color={colors.secondaryFixedDim} />
                </View>
                <View style={styles.qualityRight}>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    AVG ELO
                  </Text>
                  <Text variant="statsXl" color={colors.secondaryFixedDim}>
                    1290
                  </Text>
                </View>
              </View>

              <View style={styles.matchFooterRow}>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Icon name="map-pin" color={colors.onSurfaceVariant} size={14} />
                    <Text variant="labelSm" color={colors.onSurface}>
                      4.0 km
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="shield" color={colors.outline} size={14} />
                    <Text variant="labelSm" color={colors.onSurface}>
                      92% REP
                    </Text>
                  </View>
                </View>
                <Button label="CHALLENGE" variant="secondary" size="sm" style={{ width: 120 }} />
              </View>
            </Card>
          </View>
        ) : (
          <View style={styles.pitchesContainer}>
            {isLoading ? (
              <View style={styles.pitchesLoading}>
                <ActivityIndicator size="large" color={colors.primaryContainer} />
                <Text
                  variant="caption"
                  color={colors.textSecondary}
                  style={{ marginTop: 8 }}
                  allowFontScaling={true}
                >
                  Loading available pitches...
                </Text>
              </View>
            ) : !pitches || pitches.length === 0 ? (
              <Card style={styles.emptyPitchesCard}>
                <Icon name="search" size={28} color={colors.outline} />
                <Text
                  variant="titleS"
                  color={colors.primary}
                  style={{ marginTop: 8 }}
                  allowFontScaling={true}
                >
                  No Pitches Found
                </Text>
                <Text
                  variant="caption"
                  color={colors.textSecondary}
                  style={{ textAlign: "center", marginTop: 4 }}
                  allowFontScaling={true}
                >
                  No football pitches are currently listed in this area.
                </Text>
              </Card>
            ) : (
              pitches.map((p) => (
                <PitchCard
                  key={p.id}
                  pitch={p}
                  userLat={user?.lat}
                  userLng={user?.lng}
                  onPress={() => setSelectedPitch(p)}
                />
              ))
            )}
          </View>
        )}

        {/* Pitch Detail & Exact Inventory Modal */}
        <PitchDetailModal
          pitch={selectedPitch}
          visible={!!selectedPitch}
          onClose={() => setSelectedPitch(null)}
          userLat={user?.lat}
          userLng={user?.lng}
        />

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    backgroundColor: colors.layer0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  headerTitle: {
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: spacing.sm,
    gap: spacing.md,
  },
  filterCard: {
    gap: spacing.sm,
    padding: 12,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  distanceText: {
    fontFamily: fontFamily.stats,
    fontSize: 11,
    color: colors.onSurface,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  ghostChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: radii.default,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: "transparent",
  },
  ghostChipActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: "rgba(195, 244, 0, 0.08)",
  },
  chipText: {
    fontFamily: fontFamily.label,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
  },
  dateAndEloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  dateSelector: {
    flexDirection: "row",
    flex: 1,
    gap: 4,
  },
  ghostDateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.default,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  ghostDateChipActive: {
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainerHigh,
  },
  dateChipText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  eloRangeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.layer0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  eloRangeText: {
    fontFamily: fontFamily.stats,
    fontSize: 11,
    color: colors.primaryContainer,
  },
  tabSwitcher: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.default,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tabButtonActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.surfaceContainerHigh,
  },
  tabButtonText: {
    fontFamily: fontFamily.headline,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.4,
  },
  matchList: {
    gap: spacing.md,
  },
  matchChallengeCard: {
    gap: spacing.sm,
  },
  matchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  matchQualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  qualityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qualityRight: {
    alignItems: "flex-end",
  },
  matchFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pitchesContainer: {
    gap: spacing.sm,
  },
  pitchesLoading: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyPitchesCard: {
    padding: spacing.xl,
    alignItems: "center",
  },
});
