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

export type PlayStackParamList = {
  PlayHome: undefined;
  LookingForMatchList: undefined;
  LookingForMatchEditor: { teamId?: string } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Squad: NavigatorScreenParams<SquadStackParamList>;
  Play: NavigatorScreenParams<PlayStackParamList> | undefined;
  Profile: undefined;
};
