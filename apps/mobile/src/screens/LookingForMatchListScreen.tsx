import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TeamAvailability, TeamDetail } from "@footconnect/shared";
import { colors, spacing } from "@footconnect/ui";
import { Badge, Button, Card, Icon, Text } from "../components/ui";
import {
  AvailabilityCard,
  CaptainOnlyNotice,
} from "../components/matchmaking";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import type { PlayStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PlayStackParamList, "LookingForMatchList">;

export function LookingForMatchListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // 1. Fetch user's teams to check captain status
  const {
    data: myTeams,
    isLoading: teamsLoading,
  } = useQuery<TeamDetail[]>({
    queryKey: ["myTeams"],
    queryFn: () => api.getMyTeams(),
  });

  // 2. Fetch availabilities for user's teams
  const {
    data: availabilities,
    isLoading: availLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery<TeamAvailability[]>({
    queryKey: ["myAvailability"],
    queryFn: () => api.getMyAvailability(),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelAvailability(id),
    onMutate: (id) => {
      setCancellingId(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myAvailability"] });
    },
    onSettled: () => {
      setCancellingId(null);
    },
  });

  const teamMap = new Map<string, TeamDetail>();
  myTeams?.forEach((t) => teamMap.set(t.id, t));

  // Determine if user is captain of any active team
  const captainTeamIds = new Set(
    (myTeams ?? [])
      .filter((t) => {
        const m = t.members.find((member) => member.userId === user?.id);
        return (
          t.status === "ACTIVE" &&
          (m?.teamRole === "CAPTAIN" || m?.role === "CAPTAIN")
        );
      })
      .map((t) => t.id),
  );

  const hasCaptaincy = captainTeamIds.size > 0;
  const isLoading = teamsLoading || availLoading;

  return (
    <View style={styles.screen}>
      {/* Top Banner & Action */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text variant="titleS" color={colors.primary}>
            LOOKING FOR MATCH
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            Manage team match availability windows
          </Text>
        </View>

        {hasCaptaincy ? (
          <Button
            label="+ Set Availability"
            size="sm"
            onPress={() => navigation.navigate("LookingForMatchEditor")}
            style={{ width: 140 }}
          />
        ) : null}
      </View>

      {/* Member Notice if user has teams but is not a captain */}
      {!hasCaptaincy && (myTeams?.length ?? 0) > 0 ? (
        <View style={styles.noticeContainer}>
          <CaptainOnlyNotice />
        </View>
      ) : null}

      {/* Error state with retry */}
      {error ? (
        <Card style={styles.errorCard}>
          <Icon name="alert-triangle" size={24} color={colors.danger} />
          <Text variant="titleS" color={colors.danger}>
            Failed to Load Availability
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {error instanceof Error
              ? error.message
              : "Could not connect to server. Please check your connection."}
          </Text>
          <Button
            label="Retry"
            size="sm"
            variant="secondary"
            onPress={() => refetch()}
          />
        </Card>
      ) : null}

      {/* Content List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryContainer} />
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 8 }}>
            Loading team availability...
          </Text>
        </View>
      ) : (
        <FlatList
          data={availabilities ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primaryContainer}
            />
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Icon name="calendar" size={32} color={colors.outline} />
              <Text variant="titleS" color={colors.primary}>
                No Active Match Windows
              </Text>
              <Text
                variant="caption"
                color={colors.textSecondary}
                style={{ textAlign: "center", marginTop: 4 }}
              >
                {hasCaptaincy
                  ? "Publish a match window so other teams in Algiers can match with your squad."
                  : "Your squad captain has not scheduled any open match windows yet."}
              </Text>
              {hasCaptaincy ? (
                <Button
                  label="Create Match Window"
                  size="sm"
                  onPress={() => navigation.navigate("LookingForMatchEditor")}
                  style={{ marginTop: 12, width: 180 }}
                />
              ) : null}
            </Card>
          }
          renderItem={({ item }) => {
            const team = teamMap.get(item.teamId);
            const isCaptainOfTeam = captainTeamIds.has(item.teamId);

            return (
              <AvailabilityCard
                availability={item}
                teamName={team?.name}
                isCaptain={isCaptainOfTeam}
                onCancel={(id) => cancelMutation.mutate(id)}
                isCancelling={cancellingId === item.id && cancelMutation.isPending}
                onViewRecommendations={(id) =>
                  navigation.navigate("RecommendedOpponents", {
                    availabilityId: id,
                    teamName: team?.name,
                    teamId: item.teamId,
                    isExpired: item.status === "EXPIRED",
                  })
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
    backgroundColor: colors.layer0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  noticeContainer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xs,
  },
  listContent: {
    padding: spacing.gutter,
    gap: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.lg,
    gap: 6,
  },
  errorCard: {
    margin: spacing.gutter,
    alignItems: "center",
    gap: spacing.xs,
    borderColor: colors.danger,
    borderWidth: 1,
  },
});
