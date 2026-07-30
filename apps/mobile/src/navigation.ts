import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type SquadStackParamList = {
  TeamsList: undefined;
  CreateTeam: undefined;
  TeamDetail: { teamId: string };
  Invitations: undefined;
};

export type TabParamList = {
  Home: undefined;
  Squad: NavigatorScreenParams<SquadStackParamList>;
  Play: undefined;
  Profile: undefined;
};
