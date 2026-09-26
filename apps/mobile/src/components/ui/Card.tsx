import { View, StyleSheet, type ViewProps, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radii, shadows, spacing } from "@footconnect/ui";

export interface CardProps extends ViewProps {
  /** Top brand accent bar */
  accent?: boolean;
  /** Green/Lime neon glow for featured cards */
  glow?: boolean;
  /** Holographic elite tier gradient border */
  elite?: boolean;
  /** Tiered border color (e.g. silver, gold, bronze) */
  tierBorderColor?: string;
  padded?: boolean;
}

export function Card({
  accent,
  glow,
  elite,
  tierBorderColor,
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  if (elite) {
    return (
      <View style={[styles.eliteWrapper, glow && shadows.glowNeon, style]}>
        <LinearGradient
          colors={gradients.holographicElite as unknown as readonly [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.eliteGradient}
        >
          <View style={[styles.cardInner, padded && styles.padded]}>
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      {...rest}
      style={[
        styles.card,
        tierBorderColor ? { borderColor: tierBorderColor, borderWidth: 1.5 } : null,
        glow ? styles.glow : shadows.card,
        glow && { borderColor: colors.borderGreen },
        padded && styles.padded,
        style,
      ]}
    >
      {accent && (
        <LinearGradient
          colors={gradients.brand as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accent}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.layer1,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  eliteWrapper: {
    borderRadius: radii.xl + 2,
    overflow: "hidden",
  },
  eliteGradient: {
    padding: 2,
    borderRadius: radii.xl + 2,
  },
  cardInner: {
    backgroundColor: colors.layer1,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  padded: { padding: spacing.sm },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  glow: shadows.glowNeon,
});
