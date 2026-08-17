import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FormatCode,
  PlayerCard as SharedPlayerCard,
  TeamLineup,
  TeamLineupSlot,
} from "@footconnect/shared";
import { colors, radii, shadows, spacing } from "@footconnect/ui";
import { api } from "../../lib/api";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import {
  FORMATION_CONFIGS,
  FormationBoard,
  type FormationSlotAssignment,
} from "./FormationBoard";

export interface LineupEditorProps {
  teamId: string;
  members: SharedPlayerCard[];
  isCaptain: boolean;
}

const FORMAT_OPTIONS: Array<{
  format: FormatCode;
  label: string;
  formationCode: string;
  playerCount: number;
}> = [
  { format: "FIVE_A_SIDE", label: "5v5", formationCode: "1-2-1", playerCount: 5 },
  { format: "SEVEN_A_SIDE", label: "7v7", formationCode: "2-3-1", playerCount: 7 },
  { format: "ELEVEN_A_SIDE", label: "11v11", formationCode: "4-4-2", playerCount: 11 },
];

export function LineupEditor({ teamId, members, isCaptain }: LineupEditorProps) {
  const queryClient = useQueryClient();
  const [selectedFormat, setSelectedFormat] = useState<FormatCode>("FIVE_A_SIDE");
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  // Map of positionCode -> userId
  const [draftSlots, setDraftSlots] = useState<Map<string, string>>(new Map());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    data: lineups,
    isLoading: isLoadingLineups,
    refetch,
  } = useQuery({
    queryKey: ["teamLineups", teamId],
    queryFn: () => api.getTeamLineups(teamId),
  });

  const currentSavedLineup = useMemo(() => {
    return lineups?.find((l) => l.format === selectedFormat) ?? null;
  }, [lineups, selectedFormat]);

  // Sync draft slots when format changes or when lineups data is fetched
  useEffect(() => {
    if (currentSavedLineup) {
      const initialMap = new Map<string, string>();
      for (const slot of currentSavedLineup.slots) {
        initialMap.set(slot.positionCode, slot.userId);
      }
      setDraftSlots(initialMap);
    } else {
      setDraftSlots(new Map());
    }
    setSelectedPosition(null);
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [currentSavedLineup, selectedFormat]);

  const config = FORMATION_CONFIGS[selectedFormat];
  const memberMap = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  // Map draft map to FormationSlotAssignment array
  const activeSlots: FormationSlotAssignment[] = useMemo(() => {
    const list: FormationSlotAssignment[] = [];
    config.positions.forEach((pos, idx) => {
      const userId = draftSlots.get(pos.code);
      if (userId) {
        list.push({
          positionCode: pos.code,
          userId,
          sortOrder: idx,
        });
      }
    });
    return list;
  }, [config.positions, draftSlots]);

  // Validation
  const validation = useMemo(() => {
    const filledCount = draftSlots.size;
    const missingCount = config.playerCount - filledCount;
    const hasGk = draftSlots.has("GK");

    if (members.length < config.playerCount) {
      return {
        isValid: false,
        message: `Roster has ${members.length} player(s). ${config.playerCount} required for ${selectedFormat.replace(/_/g, " ")}.`,
        canSave: false,
      };
    }
    if (missingCount > 0) {
      return {
        isValid: false,
        message: `${filledCount}/${config.playerCount} positions assigned (${missingCount} remaining).`,
        canSave: false,
      };
    }
    if (!hasGk) {
      return {
        isValid: false,
        message: "Goalkeeper (GK) position must be filled.",
        canSave: false,
      };
    }
    return {
      isValid: true,
      message: `Complete ${config.formationCode} formation (${config.playerCount} players).`,
      canSave: true,
    };
  }, [draftSlots, config, members.length, selectedFormat]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const slotsPayload: TeamLineupSlot[] = config.positions
        .map((pos, idx) => {
          const userId = draftSlots.get(pos.code);
          if (!userId) return null;
          return {
            userId,
            positionCode: pos.code,
            sortOrder: idx,
          };
        })
        .filter((s): s is TeamLineupSlot => s !== null);

      return api.setTeamLineup(teamId, selectedFormat, {
        formationCode: config.formationCode,
        slots: slotsPayload,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teamLineups", teamId] });
      setSuccessMsg(`Lineup for ${selectedFormat.replace(/_/g, " ")} saved successfully!`);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message ?? "Could not save lineup. Please check slot assignments.");
      setSuccessMsg(null);
    },
  });

  // Slot interaction
  const handleSlotPress = (posCode: string) => {
    if (!isCaptain) return;
    setSelectedPosition(posCode);
    setSuccessMsg(null);
  };

  // Assign player to selected position with single-assignment enforcement
  const handleAssignPlayer = (userId: string) => {
    if (!selectedPosition) return;
    setDraftSlots((prev) => {
      const next = new Map(prev);
      // Remove player from any other slot first (enforce single assignment)
      for (const [pos, uId] of next.entries()) {
        if (uId === userId) {
          next.delete(pos);
        }
      }
      // Assign to selected position
      next.set(selectedPosition, userId);
      return next;
    });
    setSelectedPosition(null);
    setSuccessMsg(null);
  };

  // Unassign/clear selected slot
  const handleClearSlot = (posCode: string) => {
    setDraftSlots((prev) => {
      const next = new Map(prev);
      next.delete(posCode);
      return next;
    });
    setSelectedPosition(null);
    setSuccessMsg(null);
  };

  // Find where a player is currently assigned (if any)
  const getPlayerAssignedPos = (userId: string): string | null => {
    for (const [pos, uId] of draftSlots.entries()) {
      if (uId === userId) return pos;
    }
    return null;
  };

  const selectedPosConfig = config.positions.find((p) => p.code === selectedPosition);
  const currentAssignedUser = selectedPosition ? draftSlots.get(selectedPosition) : null;
  const currentAssignedPlayer = currentAssignedUser ? memberMap.get(currentAssignedUser) : null;

  return (
    <View style={styles.container}>
      {/* Format Segmented Tabs */}
      <View style={styles.formatTabs}>
        {FORMAT_OPTIONS.map((opt) => {
          const isTabActive = selectedFormat === opt.format;
          const hasSaved = lineups?.some((l) => l.format === opt.format);
          return (
            <TouchableOpacity
              key={opt.format}
              activeOpacity={0.7}
              onPress={() => setSelectedFormat(opt.format)}
              style={[styles.tabButton, isTabActive && styles.tabButtonActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isTabActive }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  isTabActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.tabSubLabel,
                  isTabActive ? styles.tabSubLabelActive : styles.tabSubLabelInactive,
                ]}
              >
                {opt.formationCode}
              </Text>
              {hasSaved && (
                <View
                  style={[
                    styles.savedDot,
                    { backgroundColor: isTabActive ? colors.brand : colors.textMuted },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mode / Instruction Banner */}
      <Card style={styles.bannerCard} padded={false}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerIconWrap}>
            <Icon
              name={isCaptain ? "edit" : "shield"}
              size={18}
              color={isCaptain ? colors.brand : colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleS">
              {isCaptain ? "Tactical Formation Editor" : "Active Match Lineup"}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {isCaptain
                ? "Tap any pitch position node to assign a squad player."
                : currentSavedLineup
                ? `Saved ${config.formationCode} formation by squad captain.`
                : "No saved lineup yet for this match format."}
            </Text>
          </View>
        </View>
      </Card>

      {/* Pitch Formation Board */}
      {isLoadingLineups ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text variant="caption" style={{ marginTop: spacing.sm }}>
            Loading tactical lineups...
          </Text>
        </View>
      ) : (
        <FormationBoard
          format={selectedFormat}
          slots={activeSlots}
          members={members}
          selectedPositionCode={selectedPosition}
          interactive={isCaptain}
          onSlotPress={handleSlotPress}
        />
      )}

      {/* Validation & Feedback Alerts */}
      {isCaptain && (
        <View style={styles.feedbackSection}>
          <View
            style={[
              styles.validationBox,
              validation.isValid ? styles.validationSuccess : styles.validationWarning,
            ]}
          >
            <Icon
              name={validation.isValid ? "shield-check" : "alert-triangle"}
              size={16}
              color={validation.isValid ? colors.brand : colors.warning}
            />
            <Text
              variant="caption"
              style={[
                styles.validationText,
                { color: validation.isValid ? colors.textPrimary : colors.warning },
              ]}
            >
              {validation.message}
            </Text>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Icon name="alert-triangle" size={16} color={colors.danger} />
              <Text variant="caption" color={colors.danger} style={{ flex: 1 }}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <Icon name="check" size={16} color={colors.success} />
              <Text variant="caption" color={colors.success} style={{ flex: 1 }}>
                {successMsg}
              </Text>
            </View>
          ) : null}

          <Button
            label={`Save ${config.formationCode} Lineup`}
            variant="primary"
            disabled={!validation.canSave || saveMutation.isPending}
            loading={saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
            style={styles.saveButton}
          />
        </View>
      )}

      {/* Player Assignment Modal / Sheet */}
      <Modal
        visible={Boolean(selectedPosition)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPosition(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedPosition(null)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <View style={styles.modalTitleRow}>
                  <Text variant="titleM">Assign Position</Text>
                  <View style={styles.modalPosBadge}>
                    <Text style={styles.modalPosBadgeText}>
                      {selectedPosConfig?.code}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {selectedPosConfig?.label} ({selectedPosConfig?.roleCategory})
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedPosition(null)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close player picker"
              >
                <Icon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* If a player is already assigned to this slot, allow clearing */}
            {currentAssignedPlayer && selectedPosition && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleClearSlot(selectedPosition)}
                style={styles.clearSlotButton}
              >
                <Icon name="trash-2" size={16} color={colors.loss} />
                <Text
                  variant="bodySmall"
                  color={colors.loss}
                  style={{ fontFamily: "Archivo_600SemiBold" }}
                >
                  Unassign {currentAssignedPlayer.displayName} from {selectedPosition}
                </Text>
              </TouchableOpacity>
            )}

            <Text variant="overline" style={styles.rosterHeading}>
              Active Squad Members ({members.length})
            </Text>

            {/* Member List */}
            <ScrollView
              style={styles.memberList}
              contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {members.map((m) => {
                const assignedPos = getPlayerAssignedPos(m.userId);
                const isAssignedHere = assignedPos === selectedPosition;
                const isCaptainMember =
                  (m.teamRole ?? m.role) === "CAPTAIN";

                return (
                  <TouchableOpacity
                    key={m.userId}
                    activeOpacity={0.7}
                    onPress={() => handleAssignPlayer(m.userId)}
                    style={[
                      styles.memberItem,
                      isAssignedHere && styles.memberItemActive,
                    ]}
                  >
                    <Avatar name={m.displayName} uri={m.avatarUrl} size={38} ring={isAssignedHere} />

                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.memberNameRow}>
                        <Text variant="titleS">{m.displayName}</Text>
                        {isCaptainMember && (
                          <Badge label="Captain" tone="brand" />
                        )}
                      </View>
                      <Text variant="caption" color={colors.textMuted}>
                        Pref: {m.primaryPosition ?? "FLEX"} · {m.verifiedAppearances} apps
                      </Text>
                    </View>

                    {/* Assignment status indicator */}
                    {assignedPos ? (
                      <View
                        style={[
                          styles.posAssignedTag,
                          isAssignedHere ? styles.posTagHere : styles.posTagElsewhere,
                        ]}
                      >
                        <Text
                          style={[
                            styles.posAssignedTagText,
                            { color: isAssignedHere ? colors.brand : colors.textSecondary },
                          ]}
                        >
                          {isAssignedHere ? `✓ ${assignedPos}` : `Move from ${assignedPos}`}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.assignActionTag}>
                        <Text style={styles.assignActionTagText}>+ Assign</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    width: "100%",
  },
  formatTabs: {
    flexDirection: "row",
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    position: "relative",
    minHeight: 48,
  },
  tabButtonActive: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.borderGreen,
  },
  tabLabel: {
    fontFamily: "Archivo_700Bold",
    fontSize: 14,
  },
  tabLabelActive: {
    color: colors.brand,
  },
  tabLabelInactive: {
    color: colors.textSecondary,
  },
  tabSubLabel: {
    fontFamily: "ArchivoNarrow_500Medium",
    fontSize: 11,
    marginTop: 1,
  },
  tabSubLabelActive: {
    color: colors.textPrimary,
  },
  tabSubLabelInactive: {
    color: colors.textMuted,
  },
  savedDot: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bannerCard: {
    padding: spacing.sm + 2,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackSection: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  validationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  validationSuccess: {
    backgroundColor: colors.winBg,
    borderColor: "rgba(0, 230, 118, 0.3)",
  },
  validationWarning: {
    backgroundColor: colors.drawBg,
    borderColor: "rgba(255, 178, 0, 0.3)",
  },
  validationText: {
    fontFamily: "Archivo_600SemiBold",
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.lossBg,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 94, 0.3)",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.winBg,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
  },
  saveButton: {
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 7, 10, 0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    maxHeight: "80%",
    ...shadows.raised,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  modalPosBadge: {
    backgroundColor: colors.surface3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.borderGreen,
  },
  modalPosBadgeText: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 13,
    color: colors.brand,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  clearSlotButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.lossBg,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 94, 0.3)",
  },
  rosterHeading: {
    marginBottom: spacing.xs,
  },
  memberList: {
    maxHeight: 380,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 56,
  },
  memberItemActive: {
    borderColor: colors.borderGreen,
    backgroundColor: colors.surface3,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  posAssignedTag: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    borderRadius: radii.xs,
  },
  posTagHere: {
    backgroundColor: colors.winBg,
  },
  posTagElsewhere: {
    backgroundColor: colors.surface1,
  },
  posAssignedTagText: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 11,
  },
  assignActionTag: {
    backgroundColor: "rgba(0, 230, 118, 0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
  },
  assignActionTagText: {
    fontFamily: "Archivo_700Bold",
    fontSize: 12,
    color: colors.brand,
  },
});
