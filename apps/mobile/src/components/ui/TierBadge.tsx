import { View } from "react-native";
import Svg, { Defs, LinearGradient, Polygon, Stop } from "react-native-svg";
import { tiers, type TierName } from "@footconnect/ui";
import { Text } from "./Text";

/** Hexagon shield filled with the tier's metallic gradient. */
export function TierBadge({ tier, size = 56 }: { tier: TierName; size?: number }) {
  const t = tiers[tier];
  const pts = [
    [0.5, 0.02],
    [0.95, 0.27],
    [0.95, 0.73],
    [0.5, 0.98],
    [0.05, 0.73],
    [0.05, 0.27],
  ]
    .map(([x, y]) => `${x * size},${y * size}`)
    .join(" ");

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={`tier-${tier}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.light} />
            <Stop offset="0.5" stopColor={t.base} />
            <Stop offset="1" stopColor={t.dark} />
          </LinearGradient>
        </Defs>
        <Polygon points={pts} fill={`url(#tier-${tier})`} stroke={t.dark} strokeWidth={1} />
      </Svg>
      <Text style={{ fontFamily: "Archivo_700Bold", fontSize: size * 0.34, color: "#04130B" }}>
        {tier[0]!.toUpperCase()}
      </Text>
    </View>
  );
}
