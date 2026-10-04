import type {
  AvailabilityStatus,
  MatchFormat,
  Prisma,
  TeamAvailability,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";

// Private to the matchmaking module: only the team_availabilities table is
// accessed here. Other modules must go through matchmaking.service.

export interface CreateAvailabilityRecord {
  teamId: string;
  createdById: string;
  startAt: Date;
  endAt: Date;
  format: MatchFormat;
  originLat: number;
  originLng: number;
  /** Omit to use the database default of 10 km. */
  radiusKm?: number;
  /** Omit to use the database default of ±150 Elo. */
  eloTolerance?: number;
  message?: string | null;
  expiresAt: Date;
}

export interface UpdateAvailabilityRecord {
  status?: AvailabilityStatus;
  expiresAt?: Date;
  matchedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface ListAvailabilityFilter {
  statuses?: AvailabilityStatus[];
}

export function createAvailability(
  data: CreateAvailabilityRecord,
  db: RepositoryContext = prisma,
): Promise<TeamAvailability> {
  return db.teamAvailability.create({
    data: {
      teamId: data.teamId,
      createdById: data.createdById,
      startAt: data.startAt,
      endAt: data.endAt,
      format: data.format,
      originLat: data.originLat,
      originLng: data.originLng,
      radiusKm: data.radiusKm,
      eloTolerance: data.eloTolerance,
      message: data.message ?? null,
      expiresAt: data.expiresAt,
    },
  });
}

export function findAvailabilityById(
  id: string,
  db: RepositoryContext = prisma,
): Promise<TeamAvailability | null> {
  return db.teamAvailability.findUnique({ where: { id } });
}

export function listAvailabilityByTeams(
  teamIds: string[],
  filter: ListAvailabilityFilter = {},
  db: RepositoryContext = prisma,
): Promise<TeamAvailability[]> {
  if (teamIds.length === 0) {
    return Promise.resolve([]);
  }
  const where: Prisma.TeamAvailabilityWhereInput = {
    teamId: { in: teamIds },
  };
  if (filter.statuses) {
    where.status = { in: filter.statuses };
  }
  return db.teamAvailability.findMany({
    where,
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
  });
}

export function updateAvailability(
  id: string,
  data: UpdateAvailabilityRecord,
  db: RepositoryContext = prisma,
): Promise<TeamAvailability> {
  return db.teamAvailability.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      ...(data.matchedAt !== undefined && { matchedAt: data.matchedAt }),
      ...(data.cancelledAt !== undefined && { cancelledAt: data.cancelledAt }),
    },
  });
}

export function expireDueAvailabilities(
  now: Date,
  db: RepositoryContext = prisma,
): Promise<{ count: number }> {
  return db.teamAvailability.updateMany({
    where: {
      status: "OPEN",
      OR: [{ endAt: { lte: now } }, { expiresAt: { lte: now } }],
    },
    data: {
      status: "EXPIRED",
    },
  });
}

export interface FindCandidateAvailabilitiesFilter {
  excludeTeamId: string;
  format?: MatchFormat;
  startAt?: Date;
  endAt?: Date;
}

export function findCandidateAvailabilities(
  filter: FindCandidateAvailabilitiesFilter,
  db: RepositoryContext = prisma,
): Promise<TeamAvailability[]> {
  const where: Prisma.TeamAvailabilityWhereInput = {
    teamId: { not: filter.excludeTeamId },
    status: "OPEN",
  };
  if (filter.format) {
    where.format = filter.format;
  }
  if (filter.startAt && filter.endAt) {
    where.startAt = { lt: filter.endAt };
    where.endAt = { gt: filter.startAt };
  }
  return db.teamAvailability.findMany({
    where,
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
  });
}
