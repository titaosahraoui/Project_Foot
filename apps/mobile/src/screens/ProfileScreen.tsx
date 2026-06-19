import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AuthUser, UpdateProfileInput } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function ProfileScreen() {
  const { logout, setUser } = useAuth();
  const { data, isLoading } = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => api.get<AuthUser>("/api/v1/users/me"),
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
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your profile</Text>
      <Text style={styles.email}>{data.email}</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

      <Text style={styles.label}>Position</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Striker"
        placeholderTextColor={colors.textMuted}
        value={position}
        onChangeText={setPosition}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={bio}
        onChangeText={setBio}
      />

      {mutation.isError && <Text style={styles.error}>Could not save changes.</Text>}
      {mutation.isSuccess && <Text style={styles.success}>Saved!</Text>}

      <Pressable
        style={styles.button}
        onPress={() =>
          mutation.mutate({
            displayName,
            position: position || null,
            bio: bio || null,
          })
        }
        disabled={mutation.isPending}
      >
        <Text style={styles.buttonText}>{mutation.isPending ? "Saving…" : "Save"}</Text>
      </Pressable>

      <Pressable onPress={() => void logout()}>
        <Text style={styles.link}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background, flexGrow: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  email: { color: colors.textMuted, marginBottom: spacing.md },
  label: { color: colors.textMuted, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  button: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: "center", marginTop: spacing.md },
  buttonText: { color: colors.text, fontWeight: "700" },
  link: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
  error: { color: colors.danger },
  success: { color: colors.success },
});
