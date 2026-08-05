import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AuthUser, SkillLevel, UpdateProfileInput } from "@footconnect/shared";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Badge, Button, Card, EloStat, Input, PlayerCard, Text } from "../components/ui";

const POSITION_PRESETS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "CB", "LB", "RB", "GK"];
const SKILL_LEVELS: { label: string; value: SkillLevel }[] = [
  { label: "Beginner", value: "BEGINNER" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Advanced", value: "ADVANCED" },
  { label: "Pro", value: "PRO" },
];

export function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => api.get<AuthUser>("/api/v1/users/me"),
    initialData: user ?? undefined,
  });

  const [displayName, setDisplayName] = useState("");
  const [position, setPosition] = useState("ST");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName);
      setPosition(data.position ?? "ST");
      setSkillLevel(data.skillLevel ?? null);
      setBio(data.bio ?? "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<AuthUser>("/api/v1/users/me", input),
    onSuccess: (updated) => setUser(updated),
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
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
        <View style={styles.cardWrap}>
          <PlayerCard
            name={displayName || data.displayName}
            ovr={78}
            position={(position || "ST").slice(0, 3).toUpperCase()}
            tier="gold"
            avatarUri={data.avatarUrl}
            width={180}
          />
        </View>

        <Card style={styles.statRow}>
          <EloStat elo={1000} delta={0} />
          <View style={styles.divider} />
          <View>
            <Text variant="overline">Tier</Text>
            <Text variant="stat">Gold Division</Text>
          </View>
          <View style={styles.divider} />
          <Badge label="Active" tone="brand" />
        </Card>
        <Text variant="caption" style={{ textAlign: "center" }} color={colors.textMuted}>
          Real ELO & divisions update automatically after match results verification.
        </Text>

        <Text variant="overline" style={{ marginTop: spacing.sm }}>
          Player Specs
        </Text>
        <Input label="Display name" value={displayName} onChangeText={setDisplayName} />

        {/* Position Selection Chips */}
        <View style={styles.chipSection}>
          <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>
            Preferred Position
          </Text>
          <View style={styles.chipGrid}>
            {POSITION_PRESETS.map((pos) => {
              const isSelected = position.toUpperCase() === pos;
              return (
                <TouchableOpacity
                  key={pos}
                  onPress={() => setPosition(pos)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text
                    variant="titleS"
                    color={isSelected ? colors.brand : colors.textMuted}
                    style={{ fontSize: 12 }}
                  >
                    {pos}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Skill Level Selector */}
        <View style={styles.chipSection}>
          <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>
            Self-Assessed Skill Level
          </Text>
          <View style={styles.skillGrid}>
            {SKILL_LEVELS.map((lvl) => {
              const isSelected = skillLevel === lvl.value;
              return (
                <TouchableOpacity
                  key={lvl.value}
                  onPress={() => setSkillLevel(lvl.value)}
                  style={[styles.skillChip, isSelected && styles.skillChipActive]}
                >
                  <Text
                    variant="titleS"
                    color={isSelected ? colors.brand : colors.textMuted}
                    style={{ fontSize: 12 }}
                  >
                    {lvl.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Input
          label="Player Bio"
          placeholder="Playstyle, preferred foot, local pitch..."
          value={bio}
          onChangeText={setBio}
          multiline
          style={styles.bio}
        />

        {mutation.isError ? <Text color={colors.danger}>Could not save profile changes.</Text> : null}
        {mutation.isSuccess ? <Text color={colors.success}>Profile updated successfully! ✨</Text> : null}

        <Button
          label="Save Profile"
          loading={mutation.isPending}
          onPress={() =>
            mutation.mutate({
              displayName,
              position: position || null,
              skillLevel: skillLevel || undefined,
              bio: bio || null,
            })
          }
        />
        <Button label="Sign Out" variant="ghost" onPress={() => void logout()} />
        <Text variant="caption" style={{ textAlign: "center" }} color={colors.textMuted}>
          {data.email}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: spacing.gutter, gap: spacing.sm },
  cardWrap: { alignItems: "center", marginBottom: spacing.xs },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.borderSubtle },
  bio: { height: 80, paddingTop: spacing.sm, textAlignVertical: "top" },
  chipSection: { marginVertical: spacing.xs },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.surface2,
  },
  skillGrid: { flexDirection: "row", gap: 8 },
  skillChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  skillChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.surface2,
  },
});
