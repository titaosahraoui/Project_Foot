import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@footconnect/ui";
import { Card, Icon, Text } from "../components/ui";

export function PlayScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text variant="overline">Ranked</Text>
        <Text variant="titleL" style={{ marginBottom: spacing.lg }}>
          Play
        </Text>
        <Card glow style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm }}>
          <Icon name="trophy" color={colors.brand} size={40} />
          <Text variant="titleM">Ranked matches</Text>
          <Text variant="bodySmall" style={{ textAlign: "center" }}>
            Challenge other squads, climb the divisions, and earn your ELO. Landing soon.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.gutter, flex: 1 },
});
