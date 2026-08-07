import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createTeamSchema } from "@footconnect/shared";
import { colors, spacing } from "@footconnect/ui";
import { api } from "../lib/api";
import { Button, Input, Text } from "../components/ui";
import type { SquadStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SquadStackParamList, "CreateTeam">;

export function CreateTeamScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.createTeam({ name }),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["myTeams"] });
      navigation.replace("TeamDetail", { teamId: team.id });
    },
    onError: () => setError("Could not create the squad."),
  });

  function onSubmit() {
    setError(null);
    const parsed = createTeamSchema.safeParse({ name });
    if (!parsed.success) {
      setError("Squad name must be 2–50 characters.");
      return;
    }
    mutation.mutate();
  }

  return (
    <View style={styles.screen}>
      <Text variant="overline">New squad</Text>
      <Text variant="titleL" style={{ marginBottom: spacing.md }}>
        Name your squad
      </Text>
      <Input label="Squad name" placeholder="e.g. Night Owls FC" value={name} onChangeText={setName} error={error} />
      <View style={{ height: spacing.md }} />
      <Button label="Create" loading={mutation.isPending} onPress={onSubmit} size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase, padding: spacing.gutter },
});
