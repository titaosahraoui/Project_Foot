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
import type { PaginatedMatchChallenges } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Badge, Button, Card, Icon, Text } from "../components/ui";
import { ChallengeCard } from "../components/matchmaking";
import { api } from "../lib/api";
import type { PlayStackParamList } from "../navigation";
import { fontFamily } from "../theme/fonts";

type Props = NativeStackScreenProps<PlayStackParamList, "ChallengeOutbox">;

const PAGE_SIZE = 10;

export function ChallengeOutboxScreen({ route, navigation }: Props) {
  const teamId = route.params?.teamId;
  const [page, setPage] = useState(1);

  const { data, isLoading, isRefetching, error, refetch } =
    useQuery<PaginatedMatchChallenges>({
      queryKey: ["challengeOutbox", teamId, page],
      queryFn: () =>
        api.getChallengeOutbox({
          teamId,
          page,
          pageSize: PAGE_SIZE,
        }),
    });

  const challenges = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <View style={styles.screen}>
      {/* Top Segmented Navigation: Inbox / Outbox */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={styles.segmentBtn}
          activeOpacity={0.7}
          onPress={() => navigation.replace("ChallengeInbox", { teamId })}
        >
          <Icon name="bell" size={16} color={colors.onSurfaceVariant} />
          <Text variant="labelSm" color={colors.onSurfaceVariant}>
            Received (Inbox)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, styles.segmentBtnActive]}
          activeOpacity={0.8}
        >
          <Icon name="arrow-right" size={16} color={colors.onPrimary} />
          <Text
            variant="labelSm"
            color={colors.onPrimary}
            style={{ fontWeight: "700" }}
          >
            Sent (Outbox)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error state */}
      {error ? (
        <Card style={styles.errorCard}>
          <Icon name="alert-triangle" size={24} color={colors.danger} />
          <Text variant="titleS" color={colors.danger}>
            Failed to Load Sent Challenges
          </Text>
          <Text
            variant="caption"
            color={colors.onSurfaceVariant}
            style={{ textAlign: "center" }}
          >
            {error instanceof Error
              ? error.message
              : "Could not retrieve sent challenges. Please check your network connection."}
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

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryContainer} />
          <Text
            variant="caption"
            color={colors.textSecondary}
            style={{ marginTop: 12 }}
          >
            Loading sent match challenges...
          </Text>
        </View>
      ) : (
        <FlatList
          data={challenges}
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
            <View style={styles.emptyContainer}>
              <Card style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Icon name="zap" size={28} color={colors.primaryContainer} />
                </View>
                <Text
                  variant="headlineMd"
                  color={colors.primary}
                  style={{ textAlign: "center" }}
                >
                  NO CHALLENGES SENT
                </Text>
                <Text
                  variant="bodySm"
                  color={colors.textSecondary}
                  style={{ textAlign: "center", lineHeight: 20 }}
                >
                  Set your squad match availability and discover compatible
                  opponents across Algiers to send challenges.
                </Text>
                <Button
                  label="Match Availability"
                  size="sm"
                  onPress={() => navigation.navigate("LookingForMatchList")}
                  style={{ marginTop: spacing.xs }}
                />
              </Card>
            </View>
          }
          renderItem={({ item }) => (
            <ChallengeCard
              challenge={item}
              perspective="outbox"
              onPress={(id) =>
                navigation.navigate("ChallengeDetail", { challengeId: id })
              }
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
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryContainer,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyContainer: {
    paddingTop: spacing.xl,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.lg,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.layer0,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorCard: {
    margin: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: spacing.md,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageInfoText: {
    fontFamily: fontFamily.headline,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
});
