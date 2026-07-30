import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@footconnect/ui";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { Text } from "./Text";

export type MatchResult = "W" | "L" | "D";

const TONE = { W: "win", L: "loss", D: "draw" } as const;

/** A past/upcoming fixture row. Visual; wired to real matches in Phase 5–6. */
export function MatchRow({
  opponent,
  score,
  result,
  eloDelta,
}: {
  opponent: string;
  score?: string;
  result?: MatchResult;
  eloDelta?: number;
}) {
  return (
    <View style={styles.row}>
      <Avatar name={opponent} size={36} />
      <View style={{ flex: 1 }}>
        <Text variant="titleS">{opponent}</Text>
        {score ? <Text variant="caption">Full time</Text> : <Text variant="caption">Upcoming</Text>}
      </View>
      {score ? <Text variant="stat">{score}</Text> : null}
      {result ? <Badge label={result} tone={TONE[result]} /> : null}
      {eloDelta != null ? (
        <Text
          style={{ fontFamily: "ArchivoNarrow_700Bold", fontSize: 14, width: 36, textAlign: "right" }}
          color={eloDelta >= 0 ? colors.win : colors.loss}
        >
          {eloDelta >= 0 ? `+${eloDelta}` : `${eloDelta}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
