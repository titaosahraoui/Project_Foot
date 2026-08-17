import { View, StyleSheet } from "react-native";
import { colors } from "@footconnect/ui";
import { Text } from "./Text";
import { fontFamily } from "../../theme/fonts";

interface EloStatProps {
  elo: number;
  delta?: number;
  newElo?: number;
  label?: string;
  horizontal?: boolean;
}

export function EloStat({ elo, delta, newElo, label = "ELO", horizontal }: EloStatProps) {
  if (horizontal && delta != null) {
    const computedNewElo = newElo ?? (elo + delta);
    return (
      <View style={styles.horizontalContainer}>
        {label && <Text variant="labelSm" color={colors.textSecondary}>{label}: </Text>}
        <Text style={styles.statsText}>{elo} </Text>
        <Text
          style={[styles.statsText, { color: delta >= 0 ? colors.secondaryContainer : colors.danger }]}
        >
          {delta >= 0 ? `+${delta}` : `${delta}`}{" "}
        </Text>
        <Text style={styles.statsText}>{computedNewElo}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text variant="labelSm" color={colors.textSecondary}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <Text variant="statsXl">{elo}</Text>
        {delta != null && (
          <Text
            style={styles.deltaText}
            color={delta >= 0 ? colors.secondaryContainer : colors.danger}
          >
            {delta >= 0 ? `+${delta}` : `${delta}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  horizontalContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statsText: {
    fontFamily: fontFamily.stats,
    fontSize: 16,
    color: colors.textPrimary,
  },
  deltaText: {
    fontFamily: fontFamily.stats,
    fontSize: 14,
    fontWeight: "700",
  },
});
