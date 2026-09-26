import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { Pitch } from "@footconnect/shared";
import { formatPitchPrice } from "@footconnect/shared";
import { colors, radii, spacing } from "@footconnect/ui";
import { Badge, Card, Icon, Text } from "../ui";
import { calculateDistanceKm, formatDistance } from "../../lib/geo";
import { formatPitchFormat, formatPitchSurface } from "../../lib/format-pitch";

export interface PitchCardProps {
  pitch: Pitch;
  userLat?: number | null;
  userLng?: number | null;
  onPress: () => void;
}

export function PitchCard({ pitch, userLat, userLng, onPress }: PitchCardProps) {
  const hasCoordinates =
    userLat != null &&
    userLng != null &&
    pitch.lat != null &&
    pitch.lng != null;

  const distanceKm = hasCoordinates
    ? calculateDistanceKm(userLat, userLng, pitch.lat, pitch.lng)
    : null;

  const formatLabel = formatPitchFormat(pitch.format);
  const surfaceLabel = formatPitchSurface(pitch.surface);
  const priceDisplay = `${formatPitchPrice(pitch.hourlyRate)}/h`;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View schedule for ${pitch.name}, format ${formatLabel}, ${surfaceLabel}, rate ${priceDisplay}${
        distanceKm != null ? `, distance ${formatDistance(distanceKm)}` : ""
      }`}
    >
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.titleContainer}>
            <Text
              variant="titleM"
              color={colors.primary}
              numberOfLines={2}
              allowFontScaling={true}
            >
              {pitch.name}
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text
              variant="titleS"
              color={colors.primaryContainer}
              allowFontScaling={true}
              style={styles.priceText}
            >
              {priceDisplay}
            </Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Icon name="map-pin" size={14} color={colors.onSurfaceVariant} />
          <Text
            variant="labelSm"
            color={colors.onSurfaceVariant}
            style={styles.locationText}
            numberOfLines={1}
            allowFontScaling={true}
          >
            {pitch.address}, {pitch.city}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <Badge label={formatLabel} tone="brand" />
          <Badge label={surfaceLabel} tone="neutral" />
          {distanceKm != null && (
            <View style={styles.distanceBadge}>
              <Icon name="map-pin" size={12} color={colors.primaryContainer} />
              <Text
                variant="labelXs"
                color={colors.onSurface}
                style={styles.distanceText}
                allowFontScaling={true}
              >
                {formatDistance(distanceKm)}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.xs + 2,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceText: {
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 4,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  distanceText: {
    fontWeight: "600",
  },
});
