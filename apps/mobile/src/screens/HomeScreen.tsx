import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Badge, Button, Card, Icon, Logo, Text } from "../components/ui";

export function HomeScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const { data: teams } = useQuery({ queryKey: ["myTeams"], queryFn: () => api.getMyTeams() });

  const firstName = user?.displayName?.split(" ")[0] ?? "player";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text variant="overline">Matchday</Text>
            <Text variant="titleL">Hi, {firstName}</Text>
          </View>
          <Logo size={40} />
        </View>

        {/* Next fixture */}
        <Card accent>
          <Text variant="overline">Next fixture</Text>
          <View style={{ height: spacing.sm }} />
          <Text variant="titleM">No fixtures yet</Text>
          <Text variant="bodySmall" style={{ marginTop: 4, marginBottom: spacing.md }}>
            Find your first game and start your climb.
          </Text>
          <Button label="Find a game" onPress={() => nav.navigate("Play")} />
        </Card>

        {/* Quick actions */}
        <View style={styles.actions}>
          <Card style={styles.action} padded={false}>
            <Button
              label="Create squad"
              variant="secondary"
              onPress={() => nav.navigate("Squad", { screen: "CreateTeam" })}
            />
          </Card>
          <Card style={styles.action} padded={false}>
            <Button
              label="Invitations"
              variant="secondary"
              onPress={() => nav.navigate("Squad", { screen: "Invitations" })}
            />
          </Card>
        </View>

        {/* Your squads */}
        <View style={styles.sectionHead}>
          <Text variant="overline">Your squads</Text>
          <Badge label={`${teams?.length ?? 0}`} tone="brand" />
        </View>

        {teams && teams.length > 0 ? (
          teams.map((t) => (
            <Card
              key={t.id}
              style={styles.squadRow}
              onTouchEnd={() => nav.navigate("Squad", { screen: "TeamDetail", params: { teamId: t.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text variant="titleS">{t.name}</Text>
                <Text variant="caption">
                  {t.memberCount} {t.memberCount === 1 ? "player" : "players"} · {t.skillRating} ELO
                </Text>
              </View>
              <Icon name="chevron-right" color={colors.textMuted} />
            </Card>
          ))
        ) : (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              No squads yet — create one to start.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.gutter, gap: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.md },
  action: { flex: 1, borderWidth: 0, backgroundColor: "transparent" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  squadRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
