import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { Badge, Button, Card, Icon, Text } from "../components/ui";
import type { SquadStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SquadStackParamList, "TeamsList">;

export function TeamsListScreen({ navigation }: Props) {
  const { data, isLoading } = useQuery({ queryKey: ["myTeams"], queryFn: () => api.getMyTeams() });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.navigate("Invitations")}>
          <Card style={styles.row}>
            <Icon name="bell" color={colors.brand} />
            <Text variant="titleS" style={{ flex: 1 }}>
              Invitations
            </Text>
            <Icon name="chevron-right" color={colors.textMuted} />
          </Card>
        </Pressable>

        <Text variant="overline" style={{ marginTop: spacing.sm }}>
          Your squads
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
        ) : data && data.length > 0 ? (
          data.map((t) => (
            <Pressable key={t.id} onPress={() => navigation.navigate("TeamDetail", { teamId: t.id })}>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleS">{t.name}</Text>
                  <Text variant="caption">
                    {t.memberCount} {t.memberCount === 1 ? "player" : "players"} · {t.skillRating} ELO
                  </Text>
                </View>
                <Badge label={`${t.wins}W ${t.losses}L`} />
                <Icon name="chevron-right" color={colors.textMuted} />
              </Card>
            </Pressable>
          ))
        ) : (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              No squads yet — create your first below.
            </Text>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Create squad" onPress={() => navigation.navigate("CreateTeam")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.gutter, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  footer: { padding: spacing.gutter, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
});
