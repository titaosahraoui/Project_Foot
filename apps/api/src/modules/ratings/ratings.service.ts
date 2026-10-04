import type { TeamCompetitiveSummary } from "@footconnect/shared";
import type { RepositoryContext } from "../../lib/transaction";
import * as repo from "./ratings.repository";

export async function getTeamRating(
  teamId: string,
  tx?: RepositoryContext,
): Promise<TeamCompetitiveSummary> {
  const rating = await repo.findRatingByTeamId(teamId, tx);
  if (!rating) {
    return {
      rating: 1000,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    };
  }
  return {
    rating: rating.rating,
    matchesPlayed: rating.matchesPlayed,
    wins: rating.wins,
    draws: rating.draws,
    losses: rating.losses,
  };
}

export async function getTeamRatingsBatch(
  teamIds: string[],
  tx?: RepositoryContext,
): Promise<Map<string, TeamCompetitiveSummary>> {
  if (teamIds.length === 0) {
    return new Map();
  }
  const records = await repo.findRatingsByTeamIds(teamIds, tx);
  const map = new Map<string, TeamCompetitiveSummary>();
  for (const r of records) {
    map.set(r.teamId, {
      rating: r.rating,
      matchesPlayed: r.matchesPlayed,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
    });
  }
  for (const id of teamIds) {
    if (!map.has(id)) {
      map.set(id, {
        rating: 1000,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
    }
  }
  return map;
}

export async function createInitialTeamRating(
  teamId: string,
  tx?: RepositoryContext,
): Promise<TeamCompetitiveSummary> {
  const rating = await repo.createInitialRating(teamId, tx);
  return {
    rating: rating.rating,
    matchesPlayed: rating.matchesPlayed,
    wins: rating.wins,
    draws: rating.draws,
    losses: rating.losses,
  };
}
