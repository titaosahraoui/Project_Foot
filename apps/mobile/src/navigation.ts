import type { NavigatorScreenParams } from "@react-navigation/native";
import type { TeamAvailability } from "@footconnect/shared";

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
  LookingForMatchEditor:
    | {
        teamId?: string;
        editAvailabilityId?: string;
        existingAvailability?: TeamAvailability;
      }
    | undefined;
  RecommendedOpponents: {
    availabilityId: string;
    teamName?: string;
    teamId?: string;
    isExpired?: boolean;
    availability?: TeamAvailability;
  };
  TeamDetail: { teamId: string };
};

export type TabParamList = {
  Home: undefined;
  Squad: NavigatorScreenParams<SquadStackParamList>;
  Play: NavigatorScreenParams<PlayStackParamList> | undefined;
  Profile: undefined;
};
