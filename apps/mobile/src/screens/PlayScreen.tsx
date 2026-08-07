import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { Pitch, PitchSlot } from "@footconnect/shared";
import { colors, spacing } from "@footconnect/ui";
import { Badge, Button, Card, Icon, Text } from "../components/ui";
import { api } from "../lib/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PlayScreen() {
  const [activeTab, setActiveTab] = useState<"pitches" | "challenges">("pitches");
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

  const { data: slots, isLoading: slotsLoading } = useQuery<PitchSlot[]>({
    queryKey: ["pitch-slots", selectedPitch?.id],
    queryFn: () => api.getPitchSlots(selectedPitch!.id),
    enabled: !!selectedPitch,
  });

  const renderPitchItem = ({ item }: { item: Pitch }) => (
    <TouchableOpacity activeOpacity={0.85} onPress={() => setSelectedPitch(item)}>
      <Card style={styles.pitchCard}>
        <View style={styles.pitchHeader}>
          <Text variant="titleM" color={colors.textPrimary}>
            {item.name}
          </Text>
          <Text variant="titleS" color={colors.brand}>
            ${item.pricePerHour}/h
          </Text>
        </View>

        <Text variant="bodySmall" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
          📍 {item.address}, {item.city}
        </Text>

        <View style={styles.badgeRow}>
          <Badge label={item.size.replace("_", " ")} tone="brand" />
          <Badge label={item.surface.replace("_", " ")} tone="neutral" />
        </View>

        {item.amenities.length > 0 && (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            Amenities: {item.amenities.map((a) => a.replace("_", " ")).join(" • ")}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text variant="overline">Find & Play</Text>
        <Text variant="titleL" style={{ marginBottom: spacing.md }}>
          Play Center ⚽
        </Text>

        {/* Tab switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "pitches" && styles.tabActive]}
            onPress={() => setActiveTab("pitches")}
            activeOpacity={0.7}
          >
            <Text
              variant="titleS"
              color={activeTab === "pitches" ? colors.brand : colors.textMuted}
            >
              Pitches
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "challenges" && styles.tabActive]}
            onPress={() => setActiveTab("challenges")}
            activeOpacity={0.7}
          >
            <Text
              variant="titleS"
              color={activeTab === "challenges" ? colors.brand : colors.textMuted}
            >
              Ranked Challenges
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "pitches" ? (
          <FlatList
            data={pitches || []}
            keyExtractor={(item) => item.id}
            renderItem={renderPitchItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                tintColor={colors.brand}
              />
            }
            ListEmptyComponent={
              !isLoading ? (
                <Card style={styles.emptyCard}>
                  <Icon name="map-pin" color={colors.textMuted} size={36} />
                  <Text variant="bodySmall" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                    No pitches found in your area.
                  </Text>
                </Card>
              ) : null
            }
          />
        ) : (
          <Card glow style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm }}>
            <Icon name="trophy" color={colors.brand} size={40} />
            <Text variant="titleM">Ranked Challenges</Text>
            <Text variant="bodySmall" style={{ textAlign: "center" }} color={colors.textMuted}>
              Challenge rival teams, book a pitch slot, and compete for division rank. (Phase 5).
            </Text>
          </Card>
        )}

        {/* Pitch Detail & Slot Inspector Modal */}
        <Modal
          visible={!!selectedPitch}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedPitch(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text variant="titleM">{selectedPitch?.name}</Text>
                  <Text variant="bodySmall" color={colors.textMuted}>
                    📍 {selectedPitch?.address}, {selectedPitch?.city}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedPitch(null)}>
                  <Icon name="log-out" color={colors.textMuted} size={24} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: spacing.sm, marginVertical: spacing.sm }}>
                  <Text variant="overline">Facility Details</Text>
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    <Badge label={selectedPitch?.size.replace("_", " ") ?? ""} tone="brand" />
                    <Badge label={selectedPitch?.surface.replace("_", " ") ?? ""} tone="neutral" />
                    <Badge label={`$${selectedPitch?.pricePerHour ?? 0}/hr`} tone="win" />
                  </View>

                  <Text variant="overline" style={{ marginTop: spacing.sm }}>
                    Bookable Slots
                  </Text>
                  {slotsLoading ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : !slots || slots.length === 0 ? (
                    <Text variant="caption" color={colors.textMuted}>
                      No configured availability slots for this pitch yet.
                    </Text>
                  ) : (
                    <View style={styles.slotGrid}>
                      {slots.map((s) => (
                        <View key={s.id} style={styles.slotChip}>
                          <Text variant="caption" color={colors.brand}>
                            {DAYS[s.dayOfWeek]} {s.startTime}-{s.endTime}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              <Button label="Close" variant="secondary" onPress={() => setSelectedPitch(null)} />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.gutter, flex: 1 },
  tabContainer: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tabActive: { borderColor: colors.brand },
  listContainer: { gap: spacing.sm, paddingBottom: spacing.xl },
  pitchCard: { gap: spacing.xs },
  pitchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  emptyCard: { alignItems: "center", paddingVertical: spacing.xl },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.gutter,
    gap: spacing.md,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    backgroundColor: colors.surface2,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
