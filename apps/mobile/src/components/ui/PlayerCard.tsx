import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tiers, type TierName, radii } from "@footconnect/ui";
import { Avatar } from "./Avatar";
import { Text } from "./Text";

/** FIFA-style portrait rating card. Visual; OVR/tier are placeholders until Phase 6. */
export function PlayerCard({
  name,
  ovr,
  position,
  tier,
  avatarUri,
  width = 168,
}: {
  name: string;
  ovr: number;
  position: string;
  tier: TierName;
  avatarUri?: string | null;
  width?: number;
}) {
  const t = tiers[tier];
  const height = width * 1.34;

  return (
    <LinearGradient
      colors={t.grad as unknown as readonly [string, string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { width, height }]}
    >
      {/* sheen */}
      <LinearGradient
        colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"] as unknown as readonly [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.ovr, { color: t.dark }]}>{ovr}</Text>
          <Text style={[styles.pos, { color: t.dark }]}>{position}</Text>
        </View>
        <Text style={[styles.tierLabel, { color: t.dark }]}>{tier.toUpperCase()}</Text>
      </View>
      <View style={styles.avatarWrap}>
        <Avatar name={name} uri={avatarUri} size={width * 0.42} />
      </View>
      <View style={styles.nameStrip}>
        <Text numberOfLines={1} style={styles.name}>
          {name.toUpperCase()}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 14, overflow: "hidden", justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  ovr: { fontFamily: "ArchivoNarrow_700Bold", fontSize: 40, lineHeight: 40, fontVariant: ["tabular-nums"] },
  pos: { fontFamily: "ArchivoNarrow_700Bold", fontSize: 14, letterSpacing: 1 },
  tierLabel: { fontFamily: "Archivo_700Bold", fontSize: 11, letterSpacing: 1.5 },
  avatarWrap: { alignItems: "center", justifyContent: "center", flex: 1 },
  nameStrip: { alignItems: "center" },
  name: { fontFamily: "Archivo_700Bold", fontSize: 16, color: "#04130B", letterSpacing: 0.5 },
});
