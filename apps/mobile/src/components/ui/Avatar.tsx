import { Image, StyleSheet, View } from "react-native";
import { colors, radii } from "@footconnect/ui";
import { Text } from "./Text";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Avatar({
  name,
  uri,
  size = 44,
  ring = false,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const style = {
    width: size,
    height: size,
    borderRadius: radii.pill,
    borderWidth: ring ? 2 : 1,
    borderColor: ring ? colors.borderGreen : colors.borderDefault,
  } as const;

  if (uri) {
    return <Image source={{ uri }} style={[styles.base, style]} />;
  }
  return (
    <View style={[styles.base, style, styles.fallback]}>
      <Text style={{ fontFamily: "Archivo_700Bold", fontSize: size * 0.36, color: colors.textPrimary }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  fallback: {},
});
