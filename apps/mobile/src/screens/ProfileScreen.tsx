import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AuthUser, UpdateProfileInput } from "@footconnect/shared";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Badge, Button, Card, EloStat, Input, PlayerCard, Text } from "../components/ui";

export function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const { data, isLoading } = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => api.get<AuthUser>("/api/v1/users/me"),
    initialData: user ?? undefined,
  });

  const [displayName, setDisplayName] = useState("");
  const [position, setPosition] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName);
      setPosition(data.position ?? "");
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
        <ActivityIndicator color={colors.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cardWrap}>
          <PlayerCard
            name={data.displayName}
            ovr={72}
            position={(data.position || "PLR").slice(0, 3).toUpperCase()}
            tier="bronze"
            avatarUri={data.avatarUrl}
          />
        </View>

        <Card style={styles.statRow}>
          <EloStat elo={1000} delta={0} />
          <View style={styles.divider} />
          <View>
            <Text variant="overline">Tier</Text>
            <Text variant="stat">Bronze</Text>
          </View>
          <View style={styles.divider} />
          <Badge label="Provisional" tone="brand" />
        </Card>
        <Text variant="caption" style={{ textAlign: "center" }}>
          Real ELO & divisions arrive with ranked matches.
        </Text>

        <Text variant="overline" style={{ marginTop: spacing.sm }}>
          Edit profile
        </Text>
        <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
        <Input label="Position" placeholder="e.g. Striker" value={position} onChangeText={setPosition} />
        <Input label="Bio" placeholder="Say something" value={bio} onChangeText={setBio} multiline style={styles.bio} />

        {mutation.isError ? <Text color={colors.danger}>Could not save changes.</Text> : null}
        {mutation.isSuccess ? <Text color={colors.success}>Saved.</Text> : null}

        <Button
          label="Save"
          loading={mutation.isPending}
          onPress={() => mutation.mutate({ displayName, position: position || null, bio: bio || null })}
        />
        <Button label="Sign out" variant="ghost" onPress={() => void logout()} />
        <Text variant="caption" style={{ textAlign: "center" }}>
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
  cardWrap: { alignItems: "center", marginBottom: spacing.sm },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.borderSubtle },
  bio: { height: 90, paddingTop: spacing.sm, textAlignVertical: "top" },
});
