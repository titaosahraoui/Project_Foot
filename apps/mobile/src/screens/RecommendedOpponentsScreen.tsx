import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  OpponentRecommendation,
  PaginatedRecommendations,
} from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Button, Card, Icon, Text } from "../components/ui";
import {
  EmptyOpponentsState,
  OpponentCard,
} from "../components/matchmaking";
import { api } from "../lib/api";
import type { PlayStackParamList } from "../navigation";
import { fontFamily } from "../theme/fonts";

type Props = NativeStackScreenProps<PlayStackParamList, "RecommendedOpponents">;

const PAGE_SIZE = 10;

export function RecommendedOpponentsScreen({ route, navigation }: Props) {
  const { availabilityId, teamName, teamId, isExpired } = route.params;
  const [page, setPage] = useState(1);

  // TanStack Query with availabilityId in the query key
  const {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<PaginatedRecommendations>({
    queryKey: ["recommendations", availabilityId, page, PAGE_SIZE],
    queryFn: () =>
      api.getRecommendations(availabilityId, {
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !isExpired,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Handle Expired Availability State
  if (isExpired) {
    return (
      <View style={styles.screen}>
        <View style={styles.expiredContainer}>
          <Card style={styles.expiredCard}>
            <View style={styles.expiredIconWrap}>
              <Icon name="clock" size={32} color={colors.loss} />
            </View>
            <Text variant="headlineMd" color={colors.primary} style={{ textAlign: "center" }}>
              MATCH WINDOW EXPIRED
            </Text>
            <Text
              variant="body"
              color={colors.textSecondary}
              style={{ textAlign: "center", lineHeight: 20 }}
            >
              This availability window has ended. Create a fresh match window with your squad to discover active opponents across Algiers.
            </Text>
            <Button
              label="Create New Window"
              onPress={() =>
                navigation.navigate("LookingForMatchEditor", { teamId })
              }
              style={{ marginTop: spacing.sm, width: "100%" }}
            />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Top Context Header */}
      <View style={styles.headerBar}>
        <View style={{ flex: 1 }}>
          <Text variant="titleS" color={colors.primary}>
            {teamName ? `${teamName.toUpperCase()} · OPPONENTS` : "MATCHING OPPONENTS"}
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant}>
            {total > 0
              ? `${total} compatible ${total === 1 ? "squad" : "squads"} found`
              : "Discovering opponents in Algiers"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() =>
            navigation.navigate("LookingForMatchEditor", { teamId })
          }
          activeOpacity={0.7}
        >
          <Icon name="sliders" size={14} color={colors.primaryContainer} />
          <Text variant="labelXs" color={colors.primaryContainer}>
            Edit Window
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error state with Retry */}
      {error ? (
        <Card style={styles.errorCard}>
          <Icon name="alert-triangle" size={24} color={colors.danger} />
          <Text variant="titleS" color={colors.danger}>
            Failed to Load Opponents
          </Text>
          <Text variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: "center" }}>
            {error instanceof Error
              ? error.message
              : "Could not retrieve recommendations. Please check your network connection."}
          </Text>
          <Button
            label="Retry"
            size="sm"
            variant="secondary"
            onPress={() => refetch()}
            style={{ marginTop: 4, width: 140 }}
          />
        </Card>
      ) : null}

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryContainer} />
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 12 }}>
            Calculating Elo match and proximity...
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.availabilityId}-${item.team.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primaryContainer}
            />
          }
          ListEmptyComponent={
            <EmptyOpponentsState
              onEditAvailability={() =>
                navigation.navigate("LookingForMatchEditor", { teamId })
              }
              onRefresh={() => refetch()}
              isRefreshing={isRefetching}
            />
          }
          renderItem={({ item }) => (
            <OpponentCard
              recommendation={item}
              onViewTeam={(tId) => navigation.navigate("TeamDetail", { teamId: tId })}
            />
          )}
          ListFooterComponent={
            total > PAGE_SIZE ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Icon
                    name="chevron-left"
                    size={16}
                    color={page <= 1 ? colors.outline : colors.onSurface}
                  />
                  <Text
                    variant="labelSm"
                    color={page <= 1 ? colors.outline : colors.onSurface}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfoText}>
                  Page {page} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    page >= totalPages && styles.pageBtnDisabled,
                  ]}
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Text
                    variant="labelSm"
                    color={page >= totalPages ? colors.outline : colors.onSurface}
                  >
                    Next
                  </Text>
                  <Icon
                    name="chevron-right"
                    size={16}
                    color={page >= totalPages ? colors.outline : colors.onSurface}
                  />
                </TouchableOpacity>
              </View>
            ) : null
          }
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
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
    backgroundColor: colors.layer0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(195, 244, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(195, 244, 0, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  listContent: {
    padding: spacing.gutter,
    gap: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorCard: {
    margin: spacing.gutter,
    alignItems: "center",
    gap: spacing.xs,
    borderColor: colors.danger,
    borderWidth: 1,
    padding: spacing.md,
  },
  expiredContainer: {
    flex: 1,
    padding: spacing.gutter,
    justifyContent: "center",
  },
  expiredCard: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  expiredIconWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageInfoText: {
    fontFamily: fontFamily.stats,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
});
