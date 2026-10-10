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
  participants: {
    teamId: string;
    captainId: string;
    role: MatchParticipantRole;
  }[];
}

/**
 * Repository for matches.
 * Uses ONLY matches-owned tables (matches, match_participants).
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

export async function findMatchById(
  id: string,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants | null> {
  return db.match.findUnique({
    where: { id },
    include: matchWithParticipantsInclude,
  });
}

export async function createScheduledMatch(
  data: CreateScheduledMatchData,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants> {
  return db.match.create({
    data: {
      bookingId: data.bookingId,
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      homeCaptainId: data.homeCaptainId,
      awayCaptainId: data.awayCaptainId,
      pitchOwnerId: data.pitchOwnerId,
      startAt: data.startAt,
      endAt: data.endAt,
      format: data.format,
      status: data.status ?? "SCHEDULED",
      participants: {
        create: data.participants.map((p) => ({
          teamId: p.teamId,
          captainId: p.captainId,
          role: p.role,
        })),
      },
    },
    include: matchWithParticipantsInclude,
  });
}

export async function updateMatchStatusByBookingId(
  bookingId: string,
  status: MatchStatus,
  db: RepositoryContext = prisma,
): Promise<MatchWithParticipants | null> {
  const existing = await db.match.findUnique({ where: { bookingId } });
  if (!existing) return null;
  return db.match.update({
    where: { bookingId },
    data: { status },
    include: matchWithParticipantsInclude,
  });
}
