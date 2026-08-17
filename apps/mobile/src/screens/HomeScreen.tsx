import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radii } from "@footconnect/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EloStat,
  Icon,
  Text,
  TrustSignalRing,
} from "../components/ui";
import { fontFamily } from "../theme/fonts";

export function HomeScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const { data: teams } = useQuery({ queryKey: ["myTeams"], queryFn: () => api.getMyTeams() });

  const activeTeam = teams && teams.length > 0 ? teams[0] : null;
  const firstName = user?.displayName ? user.displayName.toUpperCase() : "YACINE";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top App Bar (Header) */}
      <View style={styles.headerBar}>
        <View style={styles.headerProfile}>
          <Avatar name={user?.displayName || "Player"} size={42} />
          <View>
            <Text style={styles.headerSubtitle}>L'ÉLITE D'ALGER,</Text>
            <Text style={styles.headerTitle}>{firstName}.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
          <Icon name="bell" color={colors.onSurfaceVariant} size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Team Stats Card - Elite Tier */}
        <Card elite glow padded style={styles.teamCard}>
          <View style={styles.teamCardTop}>
            <View>
              <Text variant="headlineLgMobile" color={colors.primary}>
                {activeTeam ? activeTeam.name.toUpperCase() : "EL KHELIJ FC"}
              </Text>
              <Text variant="labelSm" color={colors.onSurfaceVariant}>
                #14 ALGER CENTRAL
              </Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>CAPTAIN</Text>
            </View>
          </View>

          <View style={styles.teamCardBottom}>
            <View>
              <Text variant="labelSm" color={colors.onSurfaceVariant} style={{ marginBottom: 2 }}>
                TEAM ELO
              </Text>
              <EloStat
                elo={activeTeam?.skillRating ?? 1316}
                delta={24}
                newElo={(activeTeam?.skillRating ?? 1316) + 24}
                horizontal
              />
            </View>

            {/* Trust Signal Sportsmanship Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4].map((i) => (
                <Icon key={i} name="star" color={colors.primaryContainer} size={15} />
              ))}
              <Icon name="star" color={colors.surfaceVariant} size={15} />
            </View>
          </View>
        </Card>

        {/* Next Match Card */}
        <Card style={styles.matchCard}>
          <View style={styles.matchCardHeader}>
            <View style={styles.matchBadgeRow}>
              <Icon name="trophy" color={colors.primaryContainer} size={16} />
              <Text variant="labelSm" color={colors.primary} style={{ fontWeight: "700" }}>
                NEXT MATCH
              </Text>
            </View>
            <Badge label="TONIGHT 21:00" tone="win" />
          </View>

          <View style={styles.matchVersusRow}>
            {/* Team 1 */}
            <View style={styles.versusTeam}>
              <View style={styles.teamEmblem}>
                <Text style={styles.teamEmblemText}>
                  {activeTeam ? activeTeam.name.slice(0, 2).toUpperCase() : "EK"}
                </Text>
              </View>
              <Text variant="labelSm" color={colors.onSurface} numberOfLines={1}>
                {activeTeam ? activeTeam.name.toUpperCase() : "EL KHELIJ"}
              </Text>
            </View>

            {/* VS */}
            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Team 2 */}
            <View style={styles.versusTeam}>
              <View style={[styles.teamEmblem, { borderColor: colors.danger }]}>
                <Text style={[styles.teamEmblemText, { color: colors.danger }]}>HL</Text>
              </View>
              <Text variant="labelSm" color={colors.onSurface} numberOfLines={1}>
                HYDRA LIONS
              </Text>
            </View>
          </View>

          {/* Location pill */}
          <View style={styles.locationPill}>
            <Icon name="map-pin" color={colors.onSurfaceVariant} size={15} />
            <Text variant="labelSm" color={colors.onSurfaceVariant}>
              ARENA HUB <Text color={colors.onSurface}>(DELY IBRAHIM)</Text>
            </Text>
          </View>
        </Card>

        {/* Primary CTA */}
        <Button
          label="PLAY / TROUVER UN MATCH"
          size="lg"
          glow
          onPress={() => nav.navigate("Play")}
          icon={<Icon name="zap" color={colors.onPrimary} size={20} />}
        />

        {/* Recommended Opponents Section */}
        <View style={styles.sectionHeaderRow}>
          <Text variant="headlineMd" color={colors.primary}>
            RECOMMENDED OPPONENTS
          </Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Icon name="sliders" color={colors.onSurfaceVariant} size={18} />
          </TouchableOpacity>
        </View>

        {/* Opponent 1: Kouba Knights */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => nav.navigate("Play")}
        >
          <Card style={styles.opponentCard}>
            <View style={styles.opponentLeft}>
              <View style={styles.opponentAvatar}>
                <Text style={styles.opponentAvatarText}>KK</Text>
              </View>
              <View>
                <Text variant="labelSm" color={colors.primary} style={{ fontWeight: "700" }}>
                  KOUBA KNIGHTS
                </Text>
                <View style={styles.opponentStatsRow}>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    ELO: 1290
                  </Text>
                  <View style={styles.dotSeparator} />
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    4.2 km
                  </Text>
                </View>
              </View>
            </View>
            <TrustSignalRing percentage={94} size={38} color={colors.secondaryContainer} />
          </Card>
        </TouchableOpacity>

        {/* Opponent 2: BEO United */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => nav.navigate("Play")}
        >
          <Card style={styles.opponentCard}>
            <View style={styles.opponentLeft}>
              <View style={[styles.opponentAvatar, { borderColor: "#CD7F32" }]}>
                <Text style={[styles.opponentAvatarText, { color: "#CD7F32" }]}>BU</Text>
              </View>
              <View>
                <Text variant="labelSm" color={colors.primary} style={{ fontWeight: "700" }}>
                  BEO UNITED
                </Text>
                <View style={styles.opponentStatsRow}>
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    ELO: 1350
                  </Text>
                  <View style={styles.dotSeparator} />
                  <Text variant="labelSm" color={colors.onSurfaceVariant}>
                    6.1 km
                  </Text>
                </View>
              </View>
            </View>
            <TrustSignalRing percentage={88} size={38} color={colors.primaryContainer} />
          </Card>
        </TouchableOpacity>

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    backgroundColor: colors.layer0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  headerProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerSubtitle: {
    fontFamily: fontFamily.label,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontFamily: fontFamily.headlineItalic,
    fontSize: 26,
    color: colors.primaryContainer,
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    padding: 8,
    borderRadius: radii.pill,
  },
  scrollContent: {
    padding: spacing.sm,
    gap: spacing.md,
  },
  teamCard: {
    gap: spacing.sm,
  },
  teamCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roleBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  roleBadgeText: {
    fontFamily: fontFamily.label,
    fontSize: 11,
    color: colors.primaryContainer,
    fontWeight: "700",
  },
  teamCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 10,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: "row",
    gap: 3,
  },
  matchCard: {
    gap: spacing.sm,
  },
  matchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: 8,
  },
  matchBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  matchVersusRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 6,
  },
  versusTeam: {
    alignItems: "center",
    width: "35%",
    gap: 4,
  },
  teamEmblem: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  teamEmblemText: {
    fontFamily: fontFamily.headline,
    fontSize: 16,
    color: colors.primary,
  },
  vsBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontFamily: fontFamily.headlineItalic,
    fontSize: 24,
    color: colors.onSurfaceVariant,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.default,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  opponentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  opponentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  opponentAvatar: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  opponentAvatarText: {
    fontFamily: fontFamily.headline,
    fontSize: 15,
    color: colors.primary,
  },
  opponentStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.outline,
  },
});
