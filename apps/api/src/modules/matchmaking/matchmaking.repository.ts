import type {
  AvailabilityStatus,
  ChallengeStatus,
  MatchChallenge,
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
  format?: MatchFormat;
  startAt?: Date;
  endAt?: Date;
  originLat?: number;
  originLng?: number;
  radiusKm?: number;
  eloTolerance?: number;
  message?: string | null;
  status?: AvailabilityStatus;
  expiresAt?: Date;
  matchedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface ListAvailabilityFilter {
  statuses?: AvailabilityStatus[];
}

export async function acquireTeamAvailabilityLock(
  teamId: string,
  db: RepositoryContext = prisma,
): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team_availability:${teamId}`}))`;
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
      ...(data.format !== undefined && { format: data.format }),
      ...(data.startAt !== undefined && { startAt: data.startAt }),
      ...(data.endAt !== undefined && { endAt: data.endAt }),
      ...(data.originLat !== undefined && { originLat: data.originLat }),
      ...(data.originLng !== undefined && { originLng: data.originLng }),
      ...(data.radiusKm !== undefined && { radiusKm: data.radiusKm }),
      ...(data.eloTolerance !== undefined && { eloTolerance: data.eloTolerance }),
      ...(data.message !== undefined && { message: data.message }),
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

// ---- Match Challenge Persistence ----

export interface CreateChallengeRecord {
  challengerTeamId: string;
  opponentTeamId: string;
  challengerAvailabilityId: string;
  opponentAvailabilityId: string;
  organizerUserId: string;
  format: MatchFormat;
  startAt: Date;
  endAt: Date;
  originLat: number;
  originLng: number;
  radiusKm: number;
  responseDeadline: Date;
  bookingDeadline?: Date | null;
  status?: ChallengeStatus;
  message?: string | null;
}

export function createChallenge(
  data: CreateChallengeRecord,
  db: RepositoryContext = prisma,
): Promise<MatchChallenge> {
  return db.matchChallenge.create({
    data: {
      challengerTeamId: data.challengerTeamId,
      opponentTeamId: data.opponentTeamId,
      challengerAvailabilityId: data.challengerAvailabilityId,
      opponentAvailabilityId: data.opponentAvailabilityId,
      organizerUserId: data.organizerUserId,
      format: data.format,
      startAt: data.startAt,
      endAt: data.endAt,
      originLat: data.originLat,
      originLng: data.originLng,
      radiusKm: data.radiusKm,
      responseDeadline: data.responseDeadline,
      bookingDeadline: data.bookingDeadline ?? null,
      status: data.status ?? "PENDING",
      message: data.message ?? null,
    },
  });
}

export function findChallengeById(
  id: string,
  db: RepositoryContext = prisma,
): Promise<MatchChallenge | null> {
  return db.matchChallenge.findUnique({ where: { id } });
}

export function findPendingChallengeByAvailabilities(
  challengerAvailabilityId: string,
  opponentAvailabilityId: string,
  db: RepositoryContext = prisma,
): Promise<MatchChallenge | null> {
  return db.matchChallenge.findFirst({
    where: {
      challengerAvailabilityId,
      opponentAvailabilityId,
      status: "PENDING",
    },
  });
}

export async function acquireAvailabilityLock(
  availabilityId: string,
  db: RepositoryContext = prisma,
): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team_availability_id:${availabilityId}`}))`;
}

export interface UpdateChallengeRecord {
  status?: ChallengeStatus;
  respondedAt?: Date | null;
  cancelledAt?: Date | null;
  bookingDeadline?: Date | null;
}

export function updateChallenge(
  id: string,
  data: UpdateChallengeRecord,
  db: RepositoryContext = prisma,
): Promise<MatchChallenge> {
  return db.matchChallenge.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.respondedAt !== undefined && { respondedAt: data.respondedAt }),
      ...(data.cancelledAt !== undefined && { cancelledAt: data.cancelledAt }),
      ...(data.bookingDeadline !== undefined && { bookingDeadline: data.bookingDeadline }),
    },
  });
}

export function matchAvailabilities(
  ids: string[],
  matchedAt: Date,
  db: RepositoryContext = prisma,
): Promise<{ count: number }> {
  return db.teamAvailability.updateMany({
    where: {
      id: { in: ids },
      status: "OPEN",
    },
    data: {
      status: "MATCHED",
      matchedAt,
    },
  });
}

export function expireOtherPendingChallenges(
  activeChallengeId: string,
  availabilityIds: string[],
  db: RepositoryContext = prisma,
): Promise<{ count: number }> {
  return db.matchChallenge.updateMany({
    where: {
      id: { not: activeChallengeId },
      status: "PENDING",
      OR: [
        { challengerAvailabilityId: { in: availabilityIds } },
        { opponentAvailabilityId: { in: availabilityIds } },
      ],
    },
    data: {
      status: "EXPIRED",
    },
  });
}

export function expireDueChallenges(
  now: Date,
  db: RepositoryContext = prisma,
): Promise<{ count: number }> {
  return db.matchChallenge.updateMany({
    where: {
      OR: [
        {
          status: "PENDING",
          OR: [
            { responseDeadline: { lte: now } },
            { startAt: { lte: now } },
          ],
        },
        {
          status: "ACCEPTED",
          OR: [
            { bookingDeadline: { lte: now } },
            { startAt: { lte: now } },
          ],
        },
      ],
    },
    data: {
      status: "EXPIRED",
    },
  });
}

export interface ListChallengesFilter {
  teamIds: string[];
  status?: ChallengeStatus;
  page?: number;
  pageSize?: number;
}

export async function findInboxChallenges(
  filter: ListChallengesFilter,
  db: RepositoryContext = prisma,
): Promise<{ items: MatchChallenge[]; total: number }> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, filter.pageSize ?? 20);
  const where: Prisma.MatchChallengeWhereInput = {
    opponentTeamId: { in: filter.teamIds },
  };
  if (filter.status) {
    where.status = filter.status;
  }
  const [total, items] = await Promise.all([
    db.matchChallenge.count({ where }),
    db.matchChallenge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items, total };
}

export async function findOutboxChallenges(
  filter: ListChallengesFilter,
  db: RepositoryContext = prisma,
): Promise<{ items: MatchChallenge[]; total: number }> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, filter.pageSize ?? 20);
  const where: Prisma.MatchChallengeWhereInput = {
    challengerTeamId: { in: filter.teamIds },
  };
  if (filter.status) {
    where.status = filter.status;
  }
  const [total, items] = await Promise.all([
    db.matchChallenge.count({ where }),
    db.matchChallenge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items, total };
}
