import { useState } from "react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PlayerCard as SharedPlayerCard } from "@footconnect/shared";
import { colors, radii, shadows, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { LineupEditor } from "../components/team/LineupEditor";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
  PlayerCard,
  Text,
} from "../components/ui";
import type { SquadStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SquadStackParamList, "TeamDetail">;
type TabKey = "roster" | "tactics" | "settings";

export function TeamDetailScreen({ route, navigation }: Props) {
  const { teamId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("roster");
  const [email, setEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [transferTarget, setTransferTarget] = useState<SharedPlayerCard | null>(null);

  const {
    data: team,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => api.getTeam(teamId),
  });

  // Invite player mutation
  const invite = useMutation({
    mutationFn: () => api.inviteToTeam(teamId, email.trim()),
    onSuccess: () => {
      setEmail("");
      setInviteMsg({ type: "success", text: "Invitation sent successfully! ✨" });
    },
    onError: (err: any) => {
      setInviteMsg({
        type: "error",
        text: err?.message ?? "Could not send invitation to that email.",
      });
    },
  });

  // Transfer captaincy mutation
  const transferCaptain = useMutation({
    mutationFn: (newCaptainUserId: string) =>
      api.transferTeamCaptain(teamId, { newCaptainUserId }),
    onSuccess: () => {
      setTransferTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      Alert.alert("Success", "Captaincy has been transferred successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Transfer Failed", err?.message ?? "Could not transfer captaincy.");
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: (targetUserId: string) => api.removeTeamMember(teamId, targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      void queryClient.invalidateQueries({ queryKey: ["teamLineups", teamId] });
    },
    onError: (err: any) => {
      Alert.alert("Removal Failed", err?.message ?? "Could not remove member.");
    },
  });

  // Leave squad mutation
  const leave = useMutation({
    mutationFn: () => api.leaveTeam(teamId, user!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      navigation.navigate("TeamsList");
    },
    onError: (err: any) => {
      Alert.alert("Failed to Leave", err?.message ?? "Could not leave squad.");
    },
  });

  // Archive squad mutation
  const archiveSquad = useMutation({
    mutationFn: () => api.archiveTeam(teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      Alert.alert("Squad Archived", "Your squad has been archived.");
    },
    onError: (err: any) => {
      Alert.alert("Archive Failed", err?.message ?? "Could not archive squad.");
    },
  });

  // Reactivate squad mutation
  const reactivateSquad = useMutation({
    mutationFn: () => api.reactivateTeam(teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      Alert.alert("Squad Reactivated", "Your squad is now active.");
    },
    onError: (err: any) => {
      Alert.alert("Reactivation Failed", err?.message ?? "Could not reactivate squad.");
    },
  });

  if (isLoading || !team) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const myMembership = team.members.find((m) => m.userId === user?.id);
  const isCaptain = (myMembership?.teamRole ?? myMembership?.role) === "CAPTAIN";
  const isArchived = team.status === "ARCHIVED";

  const competitive = team.competitive ?? {
    rating: team.skillRating ?? 1000,
    matchesPlayed: (team.wins ?? 0) + (team.losses ?? 0),
    wins: team.wins ?? 0,
    draws: 0,
    losses: team.losses ?? 0,
  };

  const handleConfirmLeave = () => {
    if (isCaptain && team.members.length > 1) {
      Alert.alert(
        "Captain Cannot Leave Directly",
        "As squad captain, please transfer captaincy to another member before leaving, or archive the squad.",
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert("Leave Squad", `Are you sure you want to leave ${team.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => leave.mutate() },
    ]);
  };

  const handleConfirmRemove = (targetUserId: string, targetName: string) => {
    Alert.alert("Remove Member", `Remove ${targetName} from the squad?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeMember.mutate(targetUserId) },
    ]);
  };

  const handleConfirmTransfer = (target: SharedPlayerCard) => {
    Alert.alert(
      "Transfer Captaincy",
      `Are you sure you want to transfer captaincy to ${target.displayName}? You will become a regular member.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          style: "destructive",
          onPress: () => transferCaptain.mutate(target.userId),
        },
      ],
    );
  };

  const handleConfirmArchive = () => {
    Alert.alert(
      "Archive Squad",
      "Archived squads cannot receive match challenges or publish pitch availability. You can reactivate anytime.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive Squad", style: "destructive", onPress: () => archiveSquad.mutate() },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.brand}
        />
      }
    >
      {/* Archived Notice Banner */}
      {isArchived && (
        <View style={styles.archivedBanner}>
          <Icon name="archive" size={18} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text variant="titleS" color={colors.warning}>
              Squad Archived
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              This squad is currently archived and inactive for matchmaking.
            </Text>
          </View>
        </View>
      )}

      {/* Team Header Card */}
      <Card glow={!isArchived} padded style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleL">{team.name}</Text>
            <Text variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
              {team.memberCount} {team.memberCount === 1 ? "player" : "players"} · Established{" "}
              {new Date(team.createdAt).getFullYear()}
            </Text>
          </View>
          {isCaptain && <Badge label="Captain" tone="brand" />}
        </View>

        {/* Competitive Elo & Badges Row */}
        <View style={styles.statsBanner}>
          <View style={styles.eloBadge}>
            <Text style={styles.eloLabel}>COMPETITIVE ELO</Text>
            <Text style={styles.eloNumber}>{competitive.rating}</Text>
          </View>
          <View style={styles.recordBadges}>
            <Badge label={`${competitive.wins}W`} tone="win" />
            <Badge label={`${competitive.draws}D`} tone="draw" />
            <Badge label={`${competitive.losses}L`} tone="loss" />
            {/* Reliability Badge */}
            <Badge label="Reliability: NEW" tone="neutral" />
          </View>
        </View>
      </Card>

      {/* Segmented Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab("roster")}
          style={[styles.tabItem, activeTab === "roster" && styles.tabItemActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "roster" }}
        >
          <Icon
            name="users"
            size={16}
            color={activeTab === "roster" ? colors.brand : colors.textMuted}
          />
          <Text
            style={[
              styles.tabItemText,
              activeTab === "roster" ? styles.tabItemTextActive : styles.tabItemTextInactive,
            ]}
          >
            Roster ({team.members.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab("tactics")}
          style={[styles.tabItem, activeTab === "tactics" && styles.tabItemActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "tactics" }}
        >
          <Icon
            name="shield"
            size={16}
            color={activeTab === "tactics" ? colors.brand : colors.textMuted}
          />
          <Text
            style={[
              styles.tabItemText,
              activeTab === "tactics" ? styles.tabItemTextActive : styles.tabItemTextInactive,
            ]}
          >
            Tactics & Lineup
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab("settings")}
          style={[styles.tabItem, activeTab === "settings" && styles.tabItemActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "settings" }}
        >
          <Icon
            name="settings"
            size={16}
            color={activeTab === "settings" ? colors.brand : colors.textMuted}
          />
          <Text
            style={[
              styles.tabItemText,
              activeTab === "settings" ? styles.tabItemTextActive : styles.tabItemTextInactive,
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: Squad Roster */}
      {activeTab === "roster" && (
        <View style={styles.sectionContainer}>
          {/* Visual Player Cards Carousel / Scroll */}
          <View style={styles.cardsSection}>
            <Text variant="overline" style={{ marginBottom: spacing.xs }}>
              Featured Player Cards
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsScroll}
            >
              {team.members.map((member) => (
                <View key={member.userId} style={styles.playerCardWrapper}>
                  <PlayerCard player={member} width={164} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Roster Management List */}
          <Text variant="overline" style={{ marginTop: spacing.sm }}>
            Squad Members Management ({team.members.length})
          </Text>
          <Card padded={false} style={styles.rosterCard}>
            {team.members.map((m) => {
              const isSelf = m.userId === user?.id;
              const isMemberCaptain = (m.teamRole ?? m.role) === "CAPTAIN";

              return (
                <View key={m.userId} style={styles.memberRow}>
                  <Avatar name={m.displayName} uri={m.avatarUrl} size={40} ring={isMemberCaptain} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.memberInfoTitleRow}>
                      <Text variant="titleS" numberOfLines={1}>
                        {m.displayName} {isSelf ? "(You)" : ""}
                      </Text>
                      {isMemberCaptain ? (
                        <Badge label="Captain" tone="brand" />
                      ) : (
                        <Text variant="caption">Member</Text>
                      )}
                    </View>
                    <Text variant="caption" color={colors.textMuted}>
                      Position: {m.primaryPosition ?? "FLEX"} · {m.verifiedAppearances} apps
                    </Text>
                  </View>

                  {/* Captain actions for other members */}
                  {isCaptain && !isSelf && (
                    <View style={styles.captainMemberActions}>
                      <TouchableOpacity
                        onPress={() => handleConfirmTransfer(m)}
                        style={styles.actionIconButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Transfer captaincy to ${m.displayName}`}
                      >
                        <Icon name="shield-check" color={colors.brand} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleConfirmRemove(m.userId, m.displayName)}
                        style={styles.actionIconButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.displayName} from squad`}
                      >
                        <Icon name="user-minus" color={colors.loss} size={18} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </Card>

          {/* Invite Section (Captain only) */}
          {isCaptain ? (
            <Card style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Text variant="overline">Invite player by email</Text>
              <Input
                placeholder="player@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {inviteMsg ? (
                <Text
                  variant="caption"
                  color={inviteMsg.type === "success" ? colors.success : colors.danger}
                >
                  {inviteMsg.text}
                </Text>
              ) : null}
              <Button
                label="Send Invite"
                loading={invite.isPending}
                onPress={() => invite.mutate()}
                disabled={!email.trim() || invite.isPending}
              />
            </Card>
          ) : (
            <Button
              label="Leave Squad"
              variant="danger"
              loading={leave.isPending}
              onPress={handleConfirmLeave}
              style={{ marginTop: spacing.xs }}
            />
          )}
        </View>
      )}

      {/* TAB 2: Tactics & Lineups */}
      {activeTab === "tactics" && (
        <View style={styles.sectionContainer}>
          <LineupEditor
            teamId={teamId}
            members={team.members}
            isCaptain={isCaptain && !isArchived}
          />
        </View>
      )}

      {/* TAB 3: Settings & Lifecycle */}
      {activeTab === "settings" && (
        <View style={styles.sectionContainer}>
          <Card style={{ gap: spacing.md }}>
            <Text variant="titleS">Squad Metadata</Text>
            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.textSecondary}>
                Status
              </Text>
              <Badge
                label={team.status}
                tone={team.status === "ACTIVE" ? "brand" : "draw"}
              />
            </View>
            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.textSecondary}>
                Matches Played
              </Text>
              <Text variant="bodySmall">{competitive.matchesPlayed}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.textSecondary}>
                Created On
              </Text>
              <Text variant="bodySmall">
                {new Date(team.createdAt).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                })}
              </Text>
            </View>
          </Card>

          {isCaptain ? (
            <Card style={{ gap: spacing.sm }}>
              <Text variant="titleS">Squad Lifecycle Controls</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {isArchived
                  ? "Reactivate this squad to resume matchmaking and pitch bookings."
                  : "Archiving your squad makes it inactive for new challenges and matchmaking while keeping match history intact."}
              </Text>

              {isArchived ? (
                <Button
                  label="Reactivate Squad"
                  variant="primary"
                  loading={reactivateSquad.isPending}
                  onPress={() => reactivateSquad.mutate()}
                />
              ) : (
                <Button
                  label="Archive Squad"
                  variant="secondary"
                  loading={archiveSquad.isPending}
                  onPress={handleConfirmArchive}
                />
              )}
            </Card>
          ) : null}

          {/* Member Leave button in Settings as well */}
          <Button
            label="Leave Squad"
            variant="danger"
            loading={leave.isPending}
            onPress={handleConfirmLeave}
          />
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
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: spacing.gutter,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  archivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.drawBg,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 178, 0, 0.4)",
  },
  headerCard: {
    gap: spacing.sm,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  eloBadge: {
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderGreen,
  },
  eloLabel: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.brand,
  },
  eloNumber: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 18,
    lineHeight: 20,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  recordBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: 44,
  },
  tabItemActive: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.borderGreen,
  },
  tabItemText: {
    fontFamily: "Archivo_600SemiBold",
    fontSize: 12,
  },
  tabItemTextActive: {
    color: colors.brand,
  },
  tabItemTextInactive: {
    color: colors.textSecondary,
  },
  sectionContainer: {
    gap: spacing.sm,
  },
  cardsSection: {
    gap: spacing.xs,
  },
  cardsScroll: {
    gap: spacing.sm,
    paddingVertical: 4,
  },
  playerCardWrapper: {
    ...shadows.card,
  },
  rosterCard: {
    paddingHorizontal: spacing.md,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    minHeight: 56,
  },
  memberInfoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  captainMemberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
});
