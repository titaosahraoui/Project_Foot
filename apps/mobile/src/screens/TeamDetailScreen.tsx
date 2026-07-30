import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Avatar, Badge, Button, Card, Input, Text } from "../components/ui";
import type { SquadStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SquadStackParamList, "TeamDetail">;

export function TeamDetailScreen({ route, navigation }: Props) {
  const { teamId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const { data: team, isLoading } = useQuery({ queryKey: ["team", teamId], queryFn: () => api.getTeam(teamId) });

  const invite = useMutation({
    mutationFn: () => api.inviteToTeam(teamId, email),
    onSuccess: () => {
      setEmail("");
      setInviteMsg("Invitation sent.");
    },
    onError: () => setInviteMsg("Could not invite that email."),
  });

  const leave = useMutation({
    mutationFn: () => api.leaveTeam(teamId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      navigation.navigate("TeamsList");
    },
  });

  if (isLoading || !team) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const isCaptain = team.members.find((m) => m.userId === user?.id)?.role === "CAPTAIN";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View>
        <Text variant="titleL">{team.name}</Text>
        <Text variant="caption">
          {team.memberCount} {team.memberCount === 1 ? "player" : "players"} · {team.skillRating} ELO ·{" "}
          {team.wins}W {team.losses}L
        </Text>
      </View>

      <Text variant="overline" style={{ marginTop: spacing.sm }}>
        Roster
      </Text>
      <Card padded={false} style={styles.roster}>
        {team.members.map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            <Avatar name={m.displayName} uri={m.avatarUrl} size={36} />
            <Text variant="titleS" style={{ flex: 1 }}>
              {m.displayName}
            </Text>
            {m.role === "CAPTAIN" ? <Badge label="Captain" tone="brand" /> : <Text variant="caption">Member</Text>}
          </View>
        ))}
      </Card>

      {isCaptain ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="overline">Invite a player</Text>
          <Input
            placeholder="player@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {inviteMsg ? <Text variant="caption">{inviteMsg}</Text> : null}
          <Button label="Send invite" loading={invite.isPending} onPress={() => invite.mutate()} />
        </Card>
      ) : (
        <Button label="Leave squad" variant="danger" loading={leave.isPending} onPress={() => leave.mutate()} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: spacing.gutter, gap: spacing.sm },
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
