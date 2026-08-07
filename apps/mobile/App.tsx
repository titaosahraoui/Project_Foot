import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@footconnect/ui";
import { fontMap } from "./src/theme/fonts";
import { Icon, type IconName } from "./src/components/ui";
import { api } from "./src/lib/api";
import { AuthProvider, useAuth } from "./src/lib/auth-context";
import type { AuthStackParamList, SquadStackParamList, TabParamList } from "./src/navigation";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PlayScreen } from "./src/screens/PlayScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { TeamsListScreen } from "./src/screens/TeamsListScreen";
import { CreateTeamScreen } from "./src/screens/CreateTeamScreen";
import { TeamDetailScreen } from "./src/screens/TeamDetailScreen";
import { InvitationsScreen } from "./src/screens/InvitationsScreen";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const SquadStack = createNativeStackNavigator<SquadStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme: NavTheme = {
  dark: true,
  colors: {
    primary: colors.brand,
    background: colors.bgBase,
    card: colors.surface1,
    text: colors.textPrimary,
    border: colors.borderSubtle,
    notification: colors.brand,
  },
  fonts: {
    regular: { fontFamily: "Archivo_400Regular", fontWeight: "400" },
    medium: { fontFamily: "Archivo_500Medium", fontWeight: "500" },
    bold: { fontFamily: "Archivo_700Bold", fontWeight: "700" },
    heavy: { fontFamily: "Archivo_700Bold", fontWeight: "800" },
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface1 },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: "Archivo_700Bold" },
  contentStyle: { backgroundColor: colors.bgBase },
} as const;

function SquadNavigator() {
  return (
    <SquadStack.Navigator screenOptions={stackScreenOptions}>
      <SquadStack.Screen name="TeamsList" component={TeamsListScreen} options={{ title: "Squads" }} />
      <SquadStack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ title: "New squad" }} />
      <SquadStack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: "Squad" }} />
      <SquadStack.Screen name="Invitations" component={InvitationsScreen} options={{ title: "Invitations" }} />
    </SquadStack.Navigator>
  );
}

const tabIcon: Record<keyof TabParamList, IconName> = {
  Home: "zap",
  Squad: "users",
  Play: "trophy",
  Profile: "user",
};

function Tabs() {
  const { data: invitations } = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api.getInvitations(),
    refetchInterval: 15000,
  });

  const pendingCount = invitations?.length ?? 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.borderSubtle,
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontFamily: "Archivo_600SemiBold", fontSize: 11 },
        tabBarIcon: ({ color }) => <Icon name={tabIcon[route.name]} color={color} size={22} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Squad"
        component={SquadNavigator}
        options={{
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand, color: colors.surface1, fontSize: 10, fontFamily: "Archivo_700Bold" },
        }}
      />
      <Tab.Screen name="Play" component={PlayScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bgBase }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (user) return <Tabs />;
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export default function App() {
  const [loaded] = useFonts(fontMap);
  const onReady = useCallback(async () => {
    if (loaded) await SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer theme={navTheme} onReady={onReady}>
            <Root />
            <StatusBar style="light" />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
