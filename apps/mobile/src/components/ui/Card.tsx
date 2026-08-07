import { View, StyleSheet, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radii, shadows, spacing } from "@footconnect/ui";

export interface CardProps extends ViewProps {
  /** 3px brand gradient accent bar across the top. */
  accent?: boolean;
  /** Green glow + brand-tinted border for featured/active cards. */
  glow?: boolean;
  padded?: boolean;
}

export function Card({ accent, glow, padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
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
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  padded: { padding: spacing.md },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  glow: shadows.glowGreen,
});
