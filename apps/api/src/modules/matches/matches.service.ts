import type {
  MatchFormat,
  MatchParticipantRole,
  MatchStatus,
  ScheduledMatchSummary,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import type { RepositoryContext } from "../../lib/transaction";
import * as teamsService from "../teams/teams.service";
import * as repo from "./matches.repository";
import type { MatchWithParticipants } from "./matches.repository";

export interface ScheduleMatchInput {
  bookingId: string;
  homeTeamId?: string;
  awayTeamId?: string;
  challengerTeamId?: string;
  opponentTeamId?: string;
  homeCaptainId?: string;
  awayCaptainId?: string;
  pitchOwnerId: string;
  startAt: Date | string;
  endAt: Date | string;
  format: MatchFormat;
}

export function toScheduledMatchSummary(
  m: MatchWithParticipants,
): ScheduledMatchSummary {
  return {
    id: m.id,
    bookingId: m.bookingId,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeCaptainId: m.homeCaptainId,
    awayCaptainId: m.awayCaptainId,
    pitchOwnerId: m.pitchOwnerId,
    startAt: m.startAt instanceof Date ? m.startAt.toISOString() : new Date(m.startAt).toISOString(),
    endAt: m.endAt instanceof Date ? m.endAt.toISOString() : new Date(m.endAt).toISOString(),
    format: m.format as MatchFormat,
    status: m.status as MatchStatus,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString(),
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : new Date(m.updatedAt).toISOString(),
    participants: m.participants.map((p) => ({
      id: p.id,
      matchId: p.matchId,
      teamId: p.teamId,
      captainId: p.captainId,
      role: p.role as MatchParticipantRole,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
    })),
  };
}

/**
 * Schedules a match from a confirmed booking.
 * Idempotent by bookingId and snapshots active captain IDs.
 * Accepts shared transaction context and uses only matches-owned tables in its repository.
 */
export async function scheduleFromConfirmedBooking(
  input: ScheduleMatchInput,
  tx?: RepositoryContext,
): Promise<ScheduledMatchSummary> {
  // Idempotency: Check if a match for this booking already exists
  const existing = await repo.findMatchByBookingId(input.bookingId, tx);
  if (existing) {
    return toScheduledMatchSummary(existing);
  }

  const homeTeamId = input.homeTeamId ?? input.challengerTeamId;
  const awayTeamId = input.awayTeamId ?? input.opponentTeamId;

  if (!homeTeamId || !awayTeamId) {
    throw new HttpError(
      400,
      "Both home and away team IDs are required to schedule a match",
      "VALIDATION_ERROR",
    );
  }

  // Snapshot active captain IDs
  const homeCaptainId =
    input.homeCaptainId ??
    (await teamsService.getActiveCaptainId(homeTeamId, tx));
  const awayCaptainId =
    input.awayCaptainId ??
    (await teamsService.getActiveCaptainId(awayTeamId, tx));

  const startAt = input.startAt instanceof Date ? input.startAt : new Date(input.startAt);
  const endAt = input.endAt instanceof Date ? input.endAt : new Date(input.endAt);

  try {
    const match = await repo.createScheduledMatch(
      {
        bookingId: input.bookingId,
        homeTeamId,
        awayTeamId,
        homeCaptainId,
        awayCaptainId,
        pitchOwnerId: input.pitchOwnerId,
        startAt,
        endAt,
        format: input.format,
        status: "SCHEDULED",
        participants: [
          {
            teamId: homeTeamId,
            captainId: homeCaptainId,
            role: "HOME",
          },
          {
            teamId: awayTeamId,
            captainId: awayCaptainId,
            role: "AWAY",
          },
        ],
      },
      tx,
    );

    return toScheduledMatchSummary(match);
  } catch (err: unknown) {
    // If concurrent insert created the match, return existing match (idempotent retry)
    const concurrent = await repo.findMatchByBookingId(input.bookingId, tx);
    if (concurrent) {
      return toScheduledMatchSummary(concurrent);
    }
    throw err;
  }
}

/**
 * Loads a scheduled match by its unique bookingId.
 */
export async function getMatchByBookingId(
  bookingId: string,
  tx?: RepositoryContext,
): Promise<ScheduledMatchSummary | null> {
  const match = await repo.findMatchByBookingId(bookingId, tx);
  return match ? toScheduledMatchSummary(match) : null;
}

/**
 * Loads a match by its ID.
 */
export async function getMatchById(
  id: string,
  tx?: RepositoryContext,
): Promise<ScheduledMatchSummary | null> {
  const match = await repo.findMatchById(id, tx);
  return match ? toScheduledMatchSummary(match) : null;
}

/**
 * Cancels a match by its bookingId in the provided transaction.
 */
export async function cancelMatchByBookingId(
  bookingId: string,
  tx?: RepositoryContext,
): Promise<ScheduledMatchSummary | null> {
  const updated = await repo.updateMatchStatusByBookingId(bookingId, "CANCELLED", tx);
  return updated ? toScheduledMatchSummary(updated) : null;
}
