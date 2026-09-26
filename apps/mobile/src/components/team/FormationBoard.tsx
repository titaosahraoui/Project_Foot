import { StyleSheet, TouchableOpacity, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { FormatCode, PlayerCard } from "@footconnect/shared";
import { colors, radii, shadows, spacing } from "@footconnect/ui";
import { Avatar } from "../ui/Avatar";
import { Text } from "../ui/Text";

export interface TacticalPosition {
  code: string;
  label: string;
  roleCategory: "GK" | "DEF" | "MID" | "FWD";
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
}

export const FORMATION_CONFIGS: Record<
  FormatCode,
  {
    formationCode: string;
    playerCount: number;
    positions: TacticalPosition[];
  }
> = {
  FIVE_A_SIDE: {
    formationCode: "1-2-1",
    playerCount: 5,
    positions: [
      { code: "GK", label: "GK", roleCategory: "GK", x: 50, y: 86 },
      { code: "LB", label: "LB", roleCategory: "DEF", x: 26, y: 62 },
      { code: "RB", label: "RB", roleCategory: "DEF", x: 74, y: 62 },
      { code: "CM", label: "CM", roleCategory: "MID", x: 50, y: 38 },
      { code: "ST", label: "ST", roleCategory: "FWD", x: 50, y: 14 },
    ],
  },
  SEVEN_A_SIDE: {
    formationCode: "2-3-1",
    playerCount: 7,
    positions: [
      { code: "GK", label: "GK", roleCategory: "GK", x: 50, y: 88 },
      { code: "LCB", label: "LCB", roleCategory: "DEF", x: 30, y: 68 },
      { code: "RCB", label: "RCB", roleCategory: "DEF", x: 70, y: 68 },
      { code: "LM", label: "LM", roleCategory: "MID", x: 18, y: 44 },
      { code: "CM", label: "CM", roleCategory: "MID", x: 50, y: 44 },
      { code: "RM", label: "RM", roleCategory: "MID", x: 82, y: 44 },
      { code: "ST", label: "ST", roleCategory: "FWD", x: 50, y: 16 },
    ],
  },
  ELEVEN_A_SIDE: {
    formationCode: "4-4-2",
    playerCount: 11,
    positions: [
      { code: "GK", label: "GK", roleCategory: "GK", x: 50, y: 88 },
      { code: "LB", label: "LB", roleCategory: "DEF", x: 14, y: 70 },
      { code: "LCB", label: "LCB", roleCategory: "DEF", x: 38, y: 70 },
      { code: "RCB", label: "RCB", roleCategory: "DEF", x: 62, y: 70 },
      { code: "RB", label: "RB", roleCategory: "DEF", x: 86, y: 70 },
      { code: "LM", label: "LM", roleCategory: "MID", x: 14, y: 44 },
      { code: "LCM", label: "LCM", roleCategory: "MID", x: 38, y: 44 },
      { code: "RCM", label: "RCM", roleCategory: "MID", x: 62, y: 44 },
      { code: "RM", label: "RM", roleCategory: "MID", x: 86, y: 44 },
      { code: "LST", label: "LST", roleCategory: "FWD", x: 36, y: 18 },
      { code: "RST", label: "RST", roleCategory: "FWD", x: 64, y: 18 },
    ],
  },
};

export interface FormationSlotAssignment {
  positionCode: string;
  userId: string;
  sortOrder: number;
}

export interface FormationBoardProps {
  format: FormatCode;
  slots?: FormationSlotAssignment[];
  members?: PlayerCard[];
  selectedPositionCode?: string | null;
  onSlotPress?: (positionCode: string, currentUserId?: string) => void;
  interactive?: boolean;
  style?: ViewStyle;
}

function PitchSvgOverlay() {
  const stroke = "rgba(0, 230, 118, 0.22)";
  const strokeWidth = 1.5;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 300 420"
      preserveAspectRatio="none"
    >
      {/* Outer Pitch Boundary */}
      <Rect
        x="12"
        y="12"
        width="276"
        height="396"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        rx="8"
      />

      {/* Halfway Line */}
      <Line
        x1="12"
        y1="210"
        x2="288"
        y2="210"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {/* Center Circle & Center Spot */}
      <Circle
        cx="150"
        cy="210"
        r="44"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Circle cx="150" cy="210" r="3" fill={stroke} />

      {/* Top Penalty Box (Opponent End) */}
      <Rect
        x="72"
        y="12"
        width="156"
        height="64"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Top Goal Area */}
      <Rect
        x="105"
        y="12"
        width="90"
        height="26"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Top Penalty Spot */}
      <Circle cx="150" cy="52" r="2.5" fill={stroke} />

      {/* Bottom Penalty Box (Home End) */}
      <Rect
        x="72"
        y="344"
        width="156"
        height="64"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Bottom Goal Area */}
      <Rect
        x="105"
        y="382"
        width="90"
        height="26"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Bottom Penalty Spot */}
      <Circle cx="150" cy="368" r="2.5" fill={stroke} />
      {/* Bottom Penalty Arc */}
      <Path
        d="M 120 344 A 32 32 0 0 1 180 344"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function FormationBoard({
  format,
  slots = [],
  members = [],
  selectedPositionCode = null,
  onSlotPress,
  interactive = false,
  style,
}: FormationBoardProps) {
  const config = FORMATION_CONFIGS[format];
  const memberMap = new Map(members.map((m) => [m.userId, m]));
  const slotMap = new Map(slots.map((s) => [s.positionCode, s]));

  const isEleven = format === "ELEVEN_A_SIDE";
  const nodeDiameter = isEleven ? 38 : 44;

  return (
    <View style={[styles.container, style]}>
      {/* Tactical Pitch Canvas */}
      <View style={styles.pitchBoard}>
        <LinearGradient
          colors={["#0C1E15", "#08130E", "#050B08"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Pitch Lines & Markings */}
        <PitchSvgOverlay />

        {/* Pitch Grass Texture Sheen */}
        <LinearGradient
          colors={["rgba(0, 230, 118, 0.08)", "rgba(0, 230, 118, 0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Position Nodes */}
        {config.positions.map((pos) => {
          const slot = slotMap.get(pos.code);
          const player = slot ? memberMap.get(slot.userId) : null;
          const isSelected = selectedPositionCode === pos.code;
          const isAssigned = Boolean(player);
          const isCaptain =
            (player?.teamRole ?? player?.role) === "CAPTAIN";

          const nodeContent = (
            <View style={styles.nodeWrapper}>
              <View
                style={[
                  styles.nodeCircle,
                  {
                    width: nodeDiameter,
                    height: nodeDiameter,
                    borderRadius: nodeDiameter / 2,
                  },
                  isAssigned ? styles.assignedNode : styles.emptyNode,
                  isSelected && styles.selectedNode,
                ]}
              >
                {isAssigned && player ? (
                  <Avatar
                    name={player.displayName}
                    uri={player.avatarUrl}
                    size={nodeDiameter - 4}
                    ring={false}
                  />
                ) : (
                  <Text
                    style={[
                      styles.emptyPosLabel,
                      { fontSize: isEleven ? 10 : 12 },
                    ]}
                  >
                    {pos.code}
                  </Text>
                )}

                {/* Captain mini badge */}
                {isAssigned && isCaptain && (
                  <View style={styles.captainPin}>
                    <Text style={styles.captainPinText}>C</Text>
                  </View>
                )}

                {/* Position pill */}
                {isAssigned && (
                  <View style={styles.posPill}>
                    <Text style={styles.posPillText}>{pos.code}</Text>
                  </View>
                )}
              </View>

              {/* Player / Position Label */}
              <View style={styles.labelContainer}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.nodeLabel,
                    isAssigned ? styles.assignedText : styles.emptyText,
                    isSelected && styles.selectedText,
                    { fontSize: isEleven ? 10 : 11, maxWidth: isEleven ? 64 : 76 },
                  ]}
                >
                  {isAssigned && player ? player.displayName : pos.label}
                </Text>
              </View>
            </View>
          );

          if (interactive && onSlotPress) {
            return (
              <TouchableOpacity
                key={pos.code}
                activeOpacity={0.7}
                onPress={() => onSlotPress(pos.code, slot?.userId)}
                style={[
                  styles.nodePositioner,
                  {
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${pos.label} position, ${
                  isAssigned && player ? player.displayName : "unassigned"
                }`}
              >
                {nodeContent}
              </TouchableOpacity>
            );
          }

          return (
            <View
              key={pos.code}
              style={[
                styles.nodePositioner,
                {
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                },
              ]}
            >
              {nodeContent}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  pitchBoard: {
    width: "100%",
    aspectRatio: 0.76,
    maxHeight: 520,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 118, 0.3)",
    position: "relative",
    ...shadows.card,
  },
  nodePositioner: {
    position: "absolute",
    transform: [{ translateX: -36 }, { translateY: -32 }],
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  nodeWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  nodeCircle: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  assignedNode: {
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.brand,
    ...shadows.raised,
  },
  emptyNode: {
    backgroundColor: "rgba(17, 22, 28, 0.75)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(232, 255, 244, 0.35)",
  },
  selectedNode: {
    borderColor: colors.brand,
    borderWidth: 2.5,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    transform: [{ scale: 1.12 }],
  },
  emptyPosLabel: {
    fontFamily: "ArchivoNarrow_700Bold",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  captainPin: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FFB200",
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#04130B",
    zIndex: 5,
  },
  captainPinText: {
    fontFamily: "Archivo_700Bold",
    fontSize: 9,
    color: "#04130B",
    lineHeight: 10,
  },
  posPill: {
    position: "absolute",
    bottom: -6,
    backgroundColor: colors.surface1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    zIndex: 4,
  },
  posPillText: {
    fontFamily: "ArchivoNarrow_700Bold",
    fontSize: 8,
    color: colors.brand,
    letterSpacing: 0.5,
  },
  labelContainer: {
    marginTop: 6,
    backgroundColor: "rgba(10, 14, 18, 0.85)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  nodeLabel: {
    textAlign: "center",
    letterSpacing: 0.3,
  },
  assignedText: {
    fontFamily: "Archivo_600SemiBold",
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: "Archivo_400Regular",
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.brand,
    fontFamily: "Archivo_700Bold",
  },
});
