import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";

// Shared screen styles built from the design tokens.
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 26, fontWeight: "700" },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  button: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: "center" },
  buttonText: { color: colors.text, fontWeight: "700" },
  secondaryButton: {
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  text: { color: colors.text },
  muted: { color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.sm },
  success: { color: colors.success, marginBottom: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
