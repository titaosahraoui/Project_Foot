import { Pressable, StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";
import { Text } from "../ui";

interface Choice<T extends string> {
  label: string;
  value: T | null;
}

interface ProfileChoiceFieldProps<T extends string> {
  label: string;
  value: T | null;
  choices: readonly Choice<T>[];
  error?: string;
  onChange: (value: T | null) => void;
}

export function ProfileChoiceField<T extends string>({
  label,
  value,
  choices,
  error,
  onChange,
}: ProfileChoiceFieldProps<T>) {
  return (
    <View style={styles.field}>
      <Text variant="overline">{label}</Text>
      <View style={styles.choices}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={choice.value ?? "not-set"}
              onPress={() => onChange(choice.value)}
              style={({ pressed }) => [
                styles.choice,
                selected ? styles.choiceSelected : null,
                pressed ? styles.choicePressed : null,
              ]}
            >
              <Text
                variant="titleS"
                color={selected ? colors.brand : colors.textMuted}
                style={styles.choiceLabel}
              >
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  choiceSelected: { borderColor: colors.brand, backgroundColor: colors.surface2 },
  choicePressed: { opacity: 0.75 },
  choiceLabel: { fontSize: 12 },
});
