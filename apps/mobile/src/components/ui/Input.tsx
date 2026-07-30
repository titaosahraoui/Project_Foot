import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";
import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.wrap}>
      {label && (
        <Text variant="overline" style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { marginLeft: spacing.xs },
  input: {
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 50,
    fontFamily: "Archivo_500Medium",
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  error: { marginLeft: spacing.xs },
});
