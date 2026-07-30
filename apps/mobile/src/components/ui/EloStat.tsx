import { View } from "react-native";
import { colors } from "@footconnect/ui";
import { Text } from "./Text";

export function EloStat({ elo, delta, label = "ELO" }: { elo: number; delta?: number; label?: string }) {
  return (
    <View>
      <Text variant="overline">{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text variant="stat">{elo}</Text>
        {delta != null && (
          <Text
            style={{ fontFamily: "ArchivoNarrow_700Bold", fontSize: 14 }}
            color={delta >= 0 ? colors.win : colors.loss}
          >
            {delta >= 0 ? `+${delta}` : `${delta}`}
          </Text>
        )}
      </View>
    </View>
  );
}
