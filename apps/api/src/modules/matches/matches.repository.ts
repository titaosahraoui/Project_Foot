import type {
  MatchFormat,
  MatchParticipantRole,
  MatchStatus,
  PlayerPosition,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";

export const matchWithParticipantsInclude = {
  participants: true,
} satisfies Prisma.MatchInclude;

export type MatchWithParticipants = Prisma.MatchGetPayload<{
  include: typeof matchWithParticipantsInclude;
}>;

export const matchDetailInclude = {
  homeTeam: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      rating: {
        select: {
          rating: true,
        },
      },
    },
  },
  awayTeam: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      rating: {
        select: {
          rating: true,
        },
      },
    },
  },
  homeCaptain: {
    select: { id: true, displayName: true },
  },
  awayCaptain: {
    select: { id: true, displayName: true },
  },
  pitchOwner: {
    select: { id: true, displayName: true },
  },
  booking: {
    select: {
      priceAmountMinor: true,
      currency: true,
      paymentStatus: true,
      pitchId: true,
      pitch: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          surface: true,
          size: true,
        },
      },
    },
  },
  participants: true,
} satisfies Prisma.MatchInclude;

export type MatchWithDetail = Prisma.MatchGetPayload<{
  include: typeof matchDetailInclude;
}>;

export interface CreateScheduledMatchData {
  bookingId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeCaptainId: string;
  awayCaptainId: string;
  pitchOwnerId: string;
  startAt: Date;
  endAt: Date;
  format: MatchFormat;
  status?: MatchStatus;
  participants: Array<{
    teamId: string;
    captainId: string;
    role: MatchParticipantRole;
  }>;
}

/**
 * Creates a scheduled match and its two participants in a single atomic insert.
 * Must be executed in the caller's transaction context.
 */
export async function createScheduledMatch(
  data: CreateScheduledMatchData,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants> {
  const { participants, ...matchData } = data;

  return db.match.create({
    data: {
      ...matchData,
      status: matchData.status ?? "SCHEDULED",
      participants: {
        create: participants.map((p) => ({
          teamId: p.teamId,
          captainId: p.captainId,
          role: p.role,
        })),
      },
    },
    include: matchWithParticipantsInclude,
  });
}

/**
 * Finds a scheduled match by its bookingId, including participants.
 */
export async function findMatchByBookingId(
  bookingId: string,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants | null> {
  return db.match.findUnique({
    where: { bookingId },
    include: matchWithParticipantsInclude,
  });
}

/**
 * Finds a scheduled match by its ID, including participants.
 */
export async function findMatchById(
  id: string,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants | null> {
  return db.match.findUnique({
    where: { id },
    include: matchWithParticipantsInclude,
  });
}

/**
 * Finds a scheduled match by its ID with all details for public fixtures view.
 */
export async function findMatchDetailById(
  id: string,
  db: RepositoryContext = prisma,
): Promise<MatchWithDetail | null> {
  return db.match.findUnique({
    where: { id },
    include: matchDetailInclude,
  });
}

/**
 * Finds matches with detailed view and pagination support.
 */
export async function findMatchesWithDetail(
  options: {
    where: Prisma.MatchWhereInput;
    orderBy: Prisma.MatchOrderByWithRelationInput;
    skip: number;
    take: number;
  },
  db: RepositoryContext = prisma,
): Promise<{ items: MatchWithDetail[]; total: number }> {
  const [items, total] = await Promise.all([
    db.match.findMany({
      where: options.where,
      orderBy: options.orderBy,
      skip: options.skip,
      take: options.take,
      include: matchDetailInclude,
    }),
    db.match.count({
      where: options.where,
    }),
  ]);

  return { items, total };
}

/**
 * Updates match status by bookingId.
 */
export async function updateMatchStatusByBookingId(
  bookingId: string,
  status: MatchStatus,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants | null> {
  return db.match.update({
    where: { bookingId },
    data: { status },
    include: matchWithParticipantsInclude,
  });
}

// ---------------------------------------------------------------------------
// Match Lineup Snapshots (M09-T02)
// ---------------------------------------------------------------------------

export const matchLineupSnapshotInclude = {
  players: {
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.MatchLineupSnapshotInclude;

export type MatchLineupSnapshotWithPlayers = Prisma.MatchLineupSnapshotGetPayload<{
  include: typeof matchLineupSnapshotInclude;
}>;

export interface CreateLineupSnapshotData {
  matchId: string;
  teamId: string;
  formationCode: string;
  submittedById: string;
  version?: number;
  isCurrent?: boolean;
  players: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    primaryPosition?: PlayerPosition | null;
    positionCode: string;
    sortOrder: number;
  }>;
}

export async function createLineupSnapshot(
  data: CreateLineupSnapshotData,
  db: RepositoryContext = prisma,
): Promise<MatchLineupSnapshotWithPlayers> {
  return db.matchLineupSnapshot.create({
    data: {
      matchId: data.matchId,
      teamId: data.teamId,
      formationCode: data.formationCode,
      submittedById: data.submittedById,
      version: data.version ?? 1,
      isCurrent: data.isCurrent ?? true,
      players: {
        create: data.players.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl ?? null,
          primaryPosition: p.primaryPosition ?? null,
          positionCode: p.positionCode,
          sortOrder: p.sortOrder,
        })),
      },
    },
    include: matchLineupSnapshotInclude,
  });
}

export async function findLatestLineupSnapshot(
  matchId: string,
  teamId: string,
  db: RepositoryContext = prisma,
): Promise<MatchLineupSnapshotWithPlayers | null> {
  return db.matchLineupSnapshot.findFirst({
    where: { matchId, teamId, isCurrent: true },
    orderBy: { version: "desc" },
    include: matchLineupSnapshotInclude,
  });
}

export async function findLineupSnapshotsByMatchAndTeam(
  matchId: string,
  teamId: string,
  db: RepositoryContext = prisma,
): Promise<MatchLineupSnapshotWithPlayers[]> {
  return db.matchLineupSnapshot.findMany({
    where: { matchId, teamId },
    orderBy: { version: "desc" },
    include: matchLineupSnapshotInclude,
  });
}

export async function findCurrentLineupsByMatchId(
  matchId: string,
  db: RepositoryContext = prisma,
): Promise<MatchLineupSnapshotWithPlayers[]> {
  return db.matchLineupSnapshot.findMany({
    where: { matchId, isCurrent: true },
    orderBy: { submittedAt: "asc" },
    include: matchLineupSnapshotInclude,
  });
}

export async function supersedeLineupSnapshot(
  snapshotId: string,
  data: { replacedById: string; replacementReason?: string },
  db: RepositoryContext = prisma,
): Promise<void> {
  await db.matchLineupSnapshot.update({
    where: { id: snapshotId },
    data: {
      isCurrent: false,
      replacedAt: new Date(),
      replacedById: data.replacedById,
      replacementReason: data.replacementReason ?? null,
    },
  });
}
