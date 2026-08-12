import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateProfileSchema,
  type AuthUser,
  type PlayerPosition,
  type SkillLevel,
  type UpdateProfileInput,
} from "@footconnect/shared";
import { colors, spacing } from "@footconnect/ui";
import { ProfileChoiceField } from "../components/profile/ProfileChoiceField";
import { ProfileLocationFields } from "../components/profile/ProfileLocationFields";
import { Badge, Button, Card, EloStat, Input, PlayerCard, Text } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const POSITION_CHOICES = [
  { label: "Not set", value: null },
  { label: "GK", value: "GK" },
  { label: "DEF", value: "DEF" },
  { label: "MID", value: "MID" },
  { label: "FWD", value: "FWD" },
  { label: "FLEX", value: "FLEX" },
] as const satisfies ReadonlyArray<{ label: string; value: PlayerPosition | null }>;

const SKILL_CHOICES = [
  { label: "Not set", value: null },
  { label: "Beginner", value: "BEGINNER" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Advanced", value: "ADVANCED" },
  { label: "Pro", value: "PRO" },
] as const satisfies ReadonlyArray<{ label: string; value: SkillLevel | null }>;

type ProfileField = keyof UpdateProfileInput;
type FieldErrors = Partial<Record<ProfileField, string>>;

function numberField(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function validateProfile(input: {
  displayName: string;
  position: PlayerPosition | null;
  skillLevel: SkillLevel | null;
  bio: string;
  avatarUrl: string;
  latitude: string;
  longitude: string;
}): { data?: UpdateProfileInput; errors: FieldErrors } {
  const latitude = numberField(input.latitude);
  const longitude = numberField(input.longitude);
  const coordinates =
    latitude === undefined && longitude === undefined
      ? { lat: null, lng: null }
      : {
          ...(latitude === undefined ? {} : { lat: latitude }),
          ...(longitude === undefined ? {} : { lng: longitude }),
        };
  const result = updateProfileSchema.safeParse({
    displayName: input.displayName,
    position: input.position,
    skillLevel: input.skillLevel,
    bio: input.bio.trim() === "" ? null : input.bio,
    avatarUrl: input.avatarUrl.trim() === "" ? null : input.avatarUrl.trim(),
    ...coordinates,
  });

  if (result.success) return { data: result.data, errors: {} };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as ProfileField] = issue.message;
    }
  }
  return { errors };
}

function ProfileEditor({
  profile,
  refreshing,
  onRefresh,
}: {
  profile: AuthUser;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { logout, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [position, setPosition] = useState<PlayerPosition | null>(profile.position);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(profile.skillLevel);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [latitude, setLatitude] = useState(profile.lat?.toString() ?? "");
  const [longitude, setLongitude] = useState(profile.lng?.toString() ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.updateMyProfile(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      setUser(updated);
      setDisplayName(updated.displayName);
      setPosition(updated.position);
      setSkillLevel(updated.skillLevel);
      setBio(updated.bio ?? "");
      setAvatarUrl(updated.avatarUrl ?? "");
      setLatitude(updated.lat?.toString() ?? "");
      setLongitude(updated.lng?.toString() ?? "");
    },
  });

  function saveProfile() {
    const result = validateProfile({
      displayName,
      position,
      skillLevel,
      bio,
      avatarUrl,
      latitude,
      longitude,
    });
    setFieldErrors(result.errors);
    if (result.data) mutation.mutate(result.data);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand}
        />
      }
    >
      <View style={styles.cardWrap}>
        <PlayerCard
          name={displayName || profile.displayName}
          ovr={78}
          position={position ?? "FLEX"}
          tier="gold"
          avatarUri={avatarUrl || null}
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
      <Text variant="caption" style={styles.centerText} color={colors.textMuted}>
        Elo and divisions update after match-result verification.
      </Text>

      <Text variant="overline" style={styles.sectionHeading}>
        Player profile
      </Text>
      <Input
        label="Display name"
        value={displayName}
        error={fieldErrors.displayName}
        onChangeText={setDisplayName}
      />
      <ProfileChoiceField
        label="Preferred position"
        value={position}
        choices={POSITION_CHOICES}
        error={fieldErrors.position}
        onChange={setPosition}
      />
      <ProfileChoiceField
        label="Self-assessed skill level"
        value={skillLevel}
        choices={SKILL_CHOICES}
        error={fieldErrors.skillLevel}
        onChange={setSkillLevel}
      />
      <Input
        label="Player bio"
        placeholder="Playstyle, preferred foot, local pitch..."
        value={bio}
        error={fieldErrors.bio}
        onChangeText={setBio}
        multiline
        style={styles.bio}
      />
      <Input
        label="Avatar HTTPS URL"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={avatarUrl}
        error={fieldErrors.avatarUrl}
        onChangeText={setAvatarUrl}
      />
      <ProfileLocationFields
        latitude={latitude}
        longitude={longitude}
        latitudeError={fieldErrors.lat}
        longitudeError={fieldErrors.lng}
        onLatitudeChange={setLatitude}
        onLongitudeChange={setLongitude}
      />

      {mutation.isError ? (
        <Text color={colors.danger}>
          Could not save your profile. Your changes are still here; retry when ready.
        </Text>
      ) : null}
      {mutation.isSuccess ? (
        <Text color={colors.success}>Profile updated successfully.</Text>
      ) : null}

      <Button label="Save profile" loading={mutation.isPending} onPress={saveProfile} />
      <Button label="Sign out" variant="ghost" onPress={() => void logout()} />
      <Text variant="caption" style={styles.centerText} color={colors.textMuted}>
        {profile.email}
      </Text>
    </ScrollView>
  );
}

export function ProfileScreen() {
  const { user } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMyProfile(),
    initialData: user ?? undefined,
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
      <ProfileEditor
        key={data.id}
        profile={data}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      />
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
  bio: { height: 96, paddingTop: spacing.sm, textAlignVertical: "top" },
  centerText: { textAlign: "center" },
  sectionHeading: { marginTop: spacing.sm },
});
