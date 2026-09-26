import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { PlayerCard as SharedPlayerCard, PlayerPosition, TeamMemberRole } from "@footconnect/shared";
import { colors, radii, shadows, spacing, tiers, type TierName } from "@footconnect/ui";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface PlayerCardProps {
  player?: SharedPlayerCard;
  userId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  primaryPosition?: PlayerPosition | string | null;
  teamRole?: TeamMemberRole | null;
  role?: TeamMemberRole | null;
  joinedAt?: string | null;
  verifiedAppearances?: number;
  cardTheme?: "FOOTCONNECT_BASE" | string;
  // Legacy / visual options for backward compatibility
  name?: string;
  ovr?: number;
  position?: string | null;
  tier?: TierName;
  avatarUri?: string | null;
  width?: number;
  compact?: boolean;
  style?: ViewStyle;
}

function formatJoined(dateString?: string | null): string {
  if (!dateString) return "MEMBER";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "MEMBER";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "MEMBER";
  }
}

/**
 * FootConnect original player card component.
 * Renders original FootConnect styling without EA logos or copyrighted assets.
 */
export function PlayerCard({
  player,
  userId,
  displayName,
  avatarUrl,
  primaryPosition,
  teamRole,
  role,
  joinedAt,
  verifiedAppearances,
  cardTheme,
  name,
  ovr,
  position,
  tier,
  avatarUri,
  width = 172,
  compact = false,
  style,
}: PlayerCardProps) {
  const resolvedName = player?.displayName ?? displayName ?? name ?? "Player";
  const resolvedAvatar = player?.avatarUrl ?? avatarUrl ?? avatarUri ?? null;
  const resolvedPosition = player?.primaryPosition ?? primaryPosition ?? position ?? "FLEX";
  const isCaptain = (player?.teamRole ?? player?.role ?? teamRole ?? role) === "CAPTAIN";
  const appearances = player?.verifiedAppearances ?? verifiedAppearances ?? 0;
  const resolvedJoined = player?.joinedAt ?? joinedAt;
  const resolvedTheme = player?.cardTheme ?? cardTheme ?? "FOOTCONNECT_BASE";

  const height = compact ? width * 1.15 : width * 1.38;
  const tierConfig = tier ? tiers[tier] : null;

  const bgColors: readonly [string, string, ...string[]] = tierConfig
    ? (tierConfig.grad as unknown as readonly [string, string, string])
    : (["#151E26", "#0D1318", "#080C0F"] as const);

  return (
    <LinearGradient
      colors={bgColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        { width, height },
        isCaptain ? styles.captainBorder : styles.standardBorder,
        shadows.card,
        style,
      ]}
    >
      {/* Subtle brand neon / sheen gradient overlay */}
      <LinearGradient
        colors={
          tierConfig
            ? (["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"] as const)
            : (["rgba(0, 230, 118, 0.12)", "rgba(0, 230, 118, 0)"] as const)
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top row: Position & OVR + Captain & Verified Apps */}
      <View style={styles.topRow}>
        <View style={styles.posBlock}>
          {ovr !== undefined && (
            <Text
              style={[
                styles.ovr,
                { color: tierConfig ? tierConfig.dark : colors.brand },
              ]}
            >
              {ovr}
            </Text>
          )}
          <View
            style={[
              styles.posBadge,
              {
                backgroundColor: tierConfig
                  ? "rgba(0,0,0,0.18)"
                  : colors.surface3,
              },
            ]}
          >
            <Text
              variant="overline"
              style={[
                styles.posText,
                { color: tierConfig ? tierConfig.dark : colors.brand },
              ]}
            >
              {resolvedPosition}
            </Text>
          </View>
        </View>

        <View style={styles.badgesCol}>
          {isCaptain && (
            <View style={styles.captainBadge}>
              <Icon name="shield" size={11} color="#04130B" />
              <Text style={styles.captainBadgeText}>CAPTAIN</Text>
            </View>
          )}
          <View
            style={[
              styles.appsBadge,
              {
                backgroundColor: tierConfig
                  ? "rgba(0,0,0,0.15)"
                  : "rgba(232, 255, 244, 0.08)",
              },
            ]}
          >
            <Text
              style={[
                styles.appsText,
                { color: tierConfig ? tierConfig.dark : colors.textSecondary },
              ]}
            >
              {appearances} {appearances === 1 ? "APP" : "APPS"}
            </Text>
          </View>
        </View>
      </View>

      {/* Center: Avatar */}
      <View style={styles.avatarWrap}>
        <Avatar
          name={resolvedName}
          uri={resolvedAvatar}
          size={compact ? width * 0.36 : width * 0.42}
          ring={!tierConfig}
        />
      </View>

      {/* Bottom: Player Name & FootConnect Theme Strip */}
      <View style={styles.bottomSection}>
        <View style={styles.nameStrip}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { color: tierConfig ? tierConfig.dark : colors.textPrimary },
            ]}
          >
            {resolvedName.toUpperCase()}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.themeTag,
              { color: tierConfig ? tierConfig.dark : colors.textMuted },
            ]}
          >
            {tierConfig ? tier?.toUpperCase() : "FC BASE"}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.joinedTag,
              { color: tierConfig ? tierConfig.dark : colors.textMuted },
            ]}
          >
            {formatJoined(resolvedJoined)}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  standardBorder: {
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
  },
  captainBorder: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 178, 0, 0.55)",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 2,
  },
  posBlock: {
    alignItems: "flex-start",
    gap: 2,
  },
  ovr: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 28,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  posBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  posText: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  badgesCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  captainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFB200",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  captainBadgeText: {
    fontFamily: "Archivo_700Bold",
    fontSize: 9,
    letterSpacing: 0.5,
    color: "#04130B",
  },
  appsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  appsText: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginVertical: spacing.xs,
    zIndex: 1,
  },
  bottomSection: {
    gap: 2,
    zIndex: 2,
  },
  nameStrip: {
    alignItems: "center",
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  name: {
    fontFamily: "Archivo_700Bold",
    fontSize: 14,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  themeTag: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  joinedTag: {
    fontFamily: "Archivo_400Regular",
    fontSize: 9,
    letterSpacing: 0.3,
  },
});
