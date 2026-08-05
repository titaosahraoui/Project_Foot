import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Avatar, Badge, Button, Card, Icon, Input, Text } from "../components/ui";
import type { SquadStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SquadStackParamList, "TeamDetail">;

export function TeamDetailScreen({ route, navigation }: Props) {
  const { teamId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const {
    data: team,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => api.getTeam(teamId),
  });

  const invite = useMutation({
    mutationFn: () => api.inviteToTeam(teamId, email),
    onSuccess: () => {
      setEmail("");
      setInviteMsg("Invitation sent successfully! ✨");
    },
    onError: () => setInviteMsg("Could not send invitation to that email."),
  });

  const removeMember = useMutation({
    mutationFn: (targetUserId: string) => api.removeTeamMember(teamId, targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
    },
  });

  const leave = useMutation({
    mutationFn: () => api.leaveTeam(teamId, user!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      navigation.navigate("TeamsList");
    },
  });

  const handleConfirmLeave = () => {
    Alert.alert("Leave Squad", "Are you sure you want to leave this squad?", [
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

  if (isLoading || !team) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const isCaptain = team.members.find((m) => m.userId === user?.id)?.role === "CAPTAIN";

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
      <Card glow padded>
        <Text variant="titleL">{team.name}</Text>
        <Text variant="bodySmall" color={colors.textMuted} style={{ marginTop: 2 }}>
          {team.memberCount} {team.memberCount === 1 ? "player" : "players"} · {team.skillRating} ELO
        </Text>
        <View style={styles.statsBanner}>
          <Badge label={`${team.wins} Wins`} tone="win" />
          <Badge label={`${team.losses} Losses`} tone="loss" />
        </View>
      </Card>

      <Text variant="overline" style={{ marginTop: spacing.sm }}>
        Squad Roster ({team.members.length})
      </Text>
      <Card padded={false} style={styles.roster}>
        {team.members.map((m) => {
          const isSelf = m.userId === user?.id;
          return (
            <View key={m.userId} style={styles.memberRow}>
              <Avatar name={m.displayName} uri={m.avatarUrl} size={36} />
              <Text variant="titleS" style={{ flex: 1 }}>
                {m.displayName} {isSelf ? "(You)" : ""}
              </Text>
              {m.role === "CAPTAIN" ? (
                <Badge label="Captain" tone="brand" />
              ) : (
                <Text variant="caption">Member</Text>
              )}

              {isCaptain && !isSelf && (
                <TouchableOpacity
                  onPress={() => handleConfirmRemove(m.userId, m.displayName)}
                  style={{ paddingLeft: spacing.xs }}
                >
                  <Icon name="log-out" color={colors.loss} size={18} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </Card>

      {isCaptain ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="overline">Invite a player by email</Text>
          <Input
            placeholder="player@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {inviteMsg ? <Text variant="caption">{inviteMsg}</Text> : null}
          <Button label="Send Invite" loading={invite.isPending} onPress={() => invite.mutate()} />
        </Card>
      ) : (
        <Button
          label="Leave Squad"
          variant="danger"
          loading={leave.isPending}
          onPress={handleConfirmLeave}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: spacing.gutter, gap: spacing.sm },
  statsBanner: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  roster: { paddingHorizontal: spacing.md },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
});
