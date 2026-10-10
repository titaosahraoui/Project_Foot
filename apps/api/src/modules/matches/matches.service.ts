import type {
  ListMatchesQuery,
  MatchDetail,
  MatchFormat,
  MatchParticipantRole,
  MatchStatus,
  MatchSummary,
  OfflinePaymentStatus,
  PaginatedMatches,
  ScheduledMatchSummary,
} from "@footconnect/shared";
import { formatMatchAlgiersLabels } from "@footconnect/shared";
import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";
import { HttpError } from "../../middleware/error-handler";
import * as teamsService from "../teams/teams.service";
import * as repo from "./matches.repository";
import type { MatchWithDetail, MatchWithParticipants } from "./matches.repository";

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

export function toMatchSummary(m: MatchWithDetail): MatchSummary {
  const { algiersDateLabel, algiersTimeRangeLabel, algiersKickoffLabel } =
    formatMatchAlgiersLabels(m.startAt, m.endAt);

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
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.name,
      logoUrl: m.homeTeam.logoUrl,
      elo: m.homeTeam.rating?.rating ?? 1000,
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.name,
      logoUrl: m.awayTeam.logoUrl,
      elo: m.awayTeam.rating?.rating ?? 1000,
    },
    pitch: {
      id: m.booking.pitch.id,
      name: m.booking.pitch.name,
      address: m.booking.pitch.address,
      city: m.booking.pitch.city,
      surface: m.booking.pitch.surface,
      format: m.booking.pitch.size,
    },
    homeCaptain: {
      id: m.homeCaptain.id,
      displayName: m.homeCaptain.displayName,
    },
    awayCaptain: {
      id: m.awayCaptain.id,
      displayName: m.awayCaptain.displayName,
    },
    algiersDateLabel,
    algiersTimeRangeLabel,
    algiersKickoffLabel,
    priceAmountMinor: m.booking.priceAmountMinor,
    currency: m.booking.currency,
    paymentStatus: m.booking.paymentStatus as OfflinePaymentStatus,
  };
}

export function toMatchDetail(
  m: MatchWithDetail,
  actorId: string,
  actorRoles: string[],
  userRoleInMatch: string,
  now: Date = new Date(),
): MatchDetail {
  const summary = toMatchSummary(m);

  const isHomeCaptain = actorId === m.homeCaptainId;
  const isAwayCaptain = actorId === m.awayCaptainId;
  const isPitchOwner = actorId === m.pitchOwnerId;
  const isAdmin = actorRoles.includes("ADMIN");
  const isCaptain = isHomeCaptain || isAwayCaptain || isAdmin;

  const isScheduled = m.status === "SCHEDULED";
  const startAtDate = m.startAt instanceof Date ? m.startAt : new Date(m.startAt);
  const endAtDate = m.endAt instanceof Date ? m.endAt : new Date(m.endAt);
  const beforeStart = now < startAtDate;
  const beforeEnd = now < endAtDate;

  const canSubmitLineup = isScheduled && beforeStart && isCaptain;
  const lineupDeadline = startAtDate.toISOString();

  const canCancel = isScheduled && beforeEnd && (isHomeCaptain || isAwayCaptain || isPitchOwner || isAdmin);
  const canSubmitResult = !beforeStart && (isCaptain || isAdmin);
  const canDispute = !beforeStart && (isCaptain || isAdmin);

  const allowedActions: string[] = [];
  if (canSubmitLineup) allowedActions.push("SUBMIT_LINEUP");
  if (canCancel) allowedActions.push("CANCEL");
  if (canSubmitResult) allowedActions.push("SUBMIT_RESULT");
  if (canDispute) allowedActions.push("DISPUTE");

  return {
    ...summary,
    pitchOwner: {
      id: m.pitchOwner.id,
      displayName: m.pitchOwner.displayName,
    },
    participants: m.participants.map((p) => ({
      id: p.id,
      matchId: p.matchId,
      teamId: p.teamId,
      captainId: p.captainId,
      role: p.role as MatchParticipantRole,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
    })),
    viewerActions: {
      canSubmitLineup,
      lineupDeadline,
      canCancel,
      canSubmitResult,
      canDispute,
      role: userRoleInMatch,
      allowedActions,
    },
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

/**
 * Gets detailed match view with viewer permission validation.
 * Player access requires active membership in either participating team;
 * designated captains retain access even if their membership later changes;
 * pitch owner and ADMIN have scoped access.
 */
export async function getMatchDetail(
  actorId: string,
  actorRoles: string[],
  matchId: string,
  now: Date = new Date(),
): Promise<MatchDetail> {
  const match = await repo.findMatchDetailById(matchId);
  if (!match) {
    throw new HttpError(404, "Match not found", "NOT_FOUND");
  }

  let userRoleInMatch: string | null = null;

  if (actorRoles.includes("ADMIN")) {
    userRoleInMatch = "ADMIN";
  } else if (match.pitchOwnerId === actorId) {
    userRoleInMatch = "PITCH_OWNER";
  } else if (match.homeCaptainId === actorId) {
    userRoleInMatch = "HOME_CAPTAIN";
  } else if (match.awayCaptainId === actorId) {
    userRoleInMatch = "AWAY_CAPTAIN";
  } else {
    // Check if player has ACTIVE membership in home or away team
    const activeMembership = await prisma.teamMembership.findFirst({
      where: {
        userId: actorId,
        teamId: { in: [match.homeTeamId, match.awayTeamId] },
        status: "ACTIVE",
      },
    });

    if (activeMembership) {
      userRoleInMatch =
        activeMembership.teamId === match.homeTeamId
          ? "HOME_PLAYER"
          : "AWAY_PLAYER";
    }
  }

  if (!userRoleInMatch) {
    throw new HttpError(
      403,
      "You do not have permission to view this match fixture",
      "FORBIDDEN",
    );
  }

  return toMatchDetail(match, actorId, actorRoles, userRoleInMatch, now);
}

/**
 * Lists matches for the current user as a player or designated captain.
 * Returns matches where user is an active member or designated captain.
 */
export async function getMyMatches(
  actorId: string,
  query: ListMatchesQuery,
  now: Date = new Date(),
): Promise<PaginatedMatches> {
  // Find all teams where user is an ACTIVE member
  const activeMemberships = await prisma.teamMembership.findMany({
    where: { userId: actorId, status: "ACTIVE" },
    select: { teamId: true },
  });
  const activeTeamIds = activeMemberships.map((m) => m.teamId);

  const viewerCondition = {
    OR: [
      { homeCaptainId: actorId },
      { awayCaptainId: actorId },
      ...(activeTeamIds.length > 0
        ? [
            { homeTeamId: { in: activeTeamIds } },
            { awayTeamId: { in: activeTeamIds } },
          ]
        : []),
    ],
  };

  const where: any = {
    ...viewerCondition,
  };

  let orderBy: any = { startAt: "asc" };
  if (query.state === "upcoming") {
    where.endAt = { gte: now };
    orderBy = { startAt: "asc" };
  } else if (query.state === "past") {
    where.endAt = { lt: now };
    orderBy = { startAt: "desc" };
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? query.limit ?? 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const { items, total } = await repo.findMatchesWithDetail({
    where,
    orderBy,
    skip,
    take,
  });

  return {
    items: items.map(toMatchSummary),
    total,
    page,
    pageSize,
  };
}

/**
 * Lists matches for pitch owner or admin.
 */
export async function getOwnerMatches(
  actorId: string,
  actorRoles: string[],
  query: ListMatchesQuery,
  now: Date = new Date(),
): Promise<PaginatedMatches> {
  const isAdmin = actorRoles.includes("ADMIN");
  const isPitchOwner = actorRoles.includes("PITCH_OWNER");

  if (!isAdmin && !isPitchOwner) {
    throw new HttpError(
      403,
      "Only pitch owners and admins can access owner match fixtures",
      "FORBIDDEN",
    );
  }

  const where: any = {};
  if (!isAdmin) {
    where.pitchOwnerId = actorId;
  }
  if (query.pitchId) {
    where.booking = { pitchId: query.pitchId };
  }

  let orderBy: any = { startAt: "asc" };
  if (query.state === "upcoming") {
    where.endAt = { gte: now };
    orderBy = { startAt: "asc" };
  } else if (query.state === "past") {
    where.endAt = { lt: now };
    orderBy = { startAt: "desc" };
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? query.limit ?? 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const { items, total } = await repo.findMatchesWithDetail({
    where,
    orderBy,
    skip,
    take,
  });

  return {
    items: items.map(toMatchSummary),
    total,
    page,
    pageSize,
  };
}
