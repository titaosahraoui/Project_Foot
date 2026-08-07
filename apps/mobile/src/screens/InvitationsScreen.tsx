import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { Button, Card, Text } from "../components/ui";

export function InvitationsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["invitations"], queryFn: () => api.getInvitations() });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invitations"] });
    queryClient.invalidateQueries({ queryKey: ["myTeams"] });
  };
  const accept = useMutation({ mutationFn: (id: string) => api.acceptInvitation(id), onSuccess: invalidate });
  const decline = useMutation({ mutationFn: (id: string) => api.declineInvitation(id), onSuccess: invalidate });

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {data && data.length > 0 ? (
        data.map((inv) => (
          <Card key={inv.id} style={{ gap: spacing.sm }}>
            <Text variant="titleS">{inv.team.name}</Text>
            <Text variant="caption">Invited by {inv.inviter.displayName}</Text>
            <View style={styles.actions}>
              <Button label="Accept" onPress={() => accept.mutate(inv.id)} loading={accept.isPending} style={{ flex: 1 }} />
              <Button
                label="Decline"
                variant="secondary"
                onPress={() => decline.mutate(inv.id)}
                loading={decline.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text variant="body" color={colors.textSecondary}>
            No pending invitations.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: spacing.gutter, gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
});
