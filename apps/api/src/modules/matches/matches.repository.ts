import type {
  MatchFormat,
  MatchParticipantRole,
  MatchStatus,
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
