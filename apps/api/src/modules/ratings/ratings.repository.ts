import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";

export function findRatingByTeamId(teamId: string, db: RepositoryContext = prisma) {
  return db.teamRating.findUnique({
    where: { teamId },
  });
}

export function createInitialRating(teamId: string, db: RepositoryContext = prisma) {
  return db.teamRating.create({
    data: {
      teamId,
      rating: 1000,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    },
  });
}
