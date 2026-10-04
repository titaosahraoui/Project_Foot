import type { TeamAvailability as TeamAvailabilityRecord } from "@prisma/client";
import {
  AVAILABILITY_MAX_DURATION_MINUTES,
  AVAILABILITY_MIN_DURATION_MINUTES,
  AVAILABILITY_MIN_LEAD_TIME_HOURS,
  buildCreateTeamAvailabilitySchema,
  buildUpdateTeamAvailabilitySchema,
  toApproximateArea,
  type CreateTeamAvailabilityInput,
  type OpponentRecommendation,
  type PaginatedRecommendations,
  type PaginationQuery,
  type PublicTeamAvailability,
  type RecommendedTeamSummary,
  type TeamAvailability,
  type UpdateTeamAvailabilityInput,
} from "@footconnect/shared";
import { withTransaction, type RepositoryContext } from "../../lib/transaction";
import { HttpError } from "../../middleware/error-handler";
import * as ratingsService from "../ratings/ratings.service";
import * as teamsService from "../teams/teams.service";
import {
  assertCanCancelAvailability,
  assertNoOpenOverlap,
} from "./availability-rules";
import * as repo from "./matchmaking.repository";
import {
  checkRecommendationEligibility,
  scoreRecommendation,
} from "./recommendation-score";

// Public surface of the matchmaking module.

function approximateAreaOf(record: TeamAvailabilityRecord) {
  return toApproximateArea({ lat: record.originLat, lng: record.originLng });
}

function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Own-team view. Raw origin coordinates are replaced by an approximate area. */
export function toTeamAvailability(
  record: TeamAvailabilityRecord,
): TeamAvailability {
  return {
    id: record.id,
    teamId: record.teamId,
    createdById: record.createdById,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    format: record.format,
    approximateArea: approximateAreaOf(record),
    radiusKm: record.radiusKm,
    eloTolerance: record.eloTolerance,
    message: record.message,
    status: record.status,
    expiresAt: record.expiresAt.toISOString(),
    matchedAt: isoOrNull(record.matchedAt),
    cancelledAt: isoOrNull(record.cancelledAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Opponent-facing view: no creator, private preferences, or raw coordinates. */
export function toPublicTeamAvailability(
  record: TeamAvailabilityRecord,
): PublicTeamAvailability {
  return {
    id: record.id,
    teamId: record.teamId,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    format: record.format,
    approximateArea: approximateAreaOf(record),
    message: record.message,
  };
}

/**
 * Creates a new looking-for-match window.
 * Only the active captain of the team may create availability.
 * A team may not have overlapping OPEN windows.
 */
export async function createAvailability(
  actorId: string,
  input: CreateTeamAvailabilityInput,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<TeamAvailability> {
  // 1. Authorize: only active captain
  await teamsService.assertActiveCaptain(input.teamId, actorId);

  // 2. Validate input and lead-time against the clock
  const schema = buildCreateTeamAvailabilitySchema(() => now);
  const payload = schema.parse(input);

  const startAt = new Date(payload.startAt);
  const endAt = new Date(payload.endAt);

  const execute = async (client: RepositoryContext) => {
    // 3. Serialize concurrent creates for the same team via transaction-level advisory lock
    await repo.acquireTeamAvailabilityLock(payload.teamId, client);

    // 4. Enforce no overlapping OPEN windows for this team
    const existing = await repo.listAvailabilityByTeams(
      [payload.teamId],
      { statuses: ["OPEN"] },
      client,
    );
    assertNoOpenOverlap({ startAt, endAt }, existing);

    // 5. Persist availability record
    const record = await repo.createAvailability(
      {
        teamId: payload.teamId,
        createdById: actorId,
        startAt,
        endAt,
        format: payload.format,
        originLat: payload.origin.lat,
        originLng: payload.origin.lng,
        radiusKm: payload.radiusKm,
        eloTolerance: payload.eloTolerance,
        message: payload.message,
        expiresAt: startAt,
      },
      client,
    );

    return toTeamAvailability(record);
  };

  try {
    if (tx) {
      return await execute(tx);
    }
    return await withTransaction(execute);
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      throw err;
    }
    const errMessage = err instanceof Error ? err.message : String(err);
    const errCode = (err as { code?: string })?.code;
    if (
      errCode === "P2002" ||
      errCode === "P2010" ||
      errMessage.includes("team_availabilities_no_overlapping_open") ||
      errMessage.includes("exclusion")
    ) {
      throw new HttpError(
        409,
        "Team already has an open availability that overlaps with this time window",
      );
    }
    throw err;
  }
}

/**
 * Lists all availabilities for the teams where actorId is an active member.
 */
export async function listMyAvailability(
  actorId: string,
  tx?: RepositoryContext,
): Promise<TeamAvailability[]> {
  const myTeams = await teamsService.getMyTeams(actorId);
  const teamIds = myTeams.map((t) => t.id);
  if (teamIds.length === 0) {
    return [];
  }
  const records = await repo.listAvailabilityByTeams(teamIds, {}, tx);
  return records.map(toTeamAvailability);
}

/**
 * Retrieves a single availability for an active member of the team.
 */
export async function getAvailability(
  actorId: string,
  id: string,
  tx?: RepositoryContext,
): Promise<TeamAvailability> {
  const availability = await repo.findAvailabilityById(id, tx);
  if (!availability) {
    throw new HttpError(404, "Availability not found");
  }

  const myTeams = await teamsService.getMyTeams(actorId);
  const isMember = myTeams.some((t) => t.id === availability.teamId);
  if (!isMember) {
    throw new HttpError(403, "You do not have access to this availability");
  }

  return toTeamAvailability(availability);
}

/**
 * Updates an OPEN team availability.
 * Only the active captain can update.
 * Allows adjusting format, time window, radius, Elo tolerance, or message.
 */
export async function updateAvailability(
  actorId: string,
  id: string,
  input: UpdateTeamAvailabilityInput,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<TeamAvailability> {
  const availability = await repo.findAvailabilityById(id, tx);
  if (!availability) {
    throw new HttpError(404, "Availability not found");
  }

  await teamsService.assertActiveCaptain(availability.teamId, actorId);

  if (availability.status !== "OPEN") {
    throw new HttpError(
      409,
      `Cannot edit availability with status ${availability.status}`,
    );
  }

  const schema = buildUpdateTeamAvailabilitySchema(() => now);
  const payload = schema.parse(input);

  const newStartAt = payload.startAt
    ? new Date(payload.startAt)
    : availability.startAt;
  const newEndAt = payload.endAt
    ? new Date(payload.endAt)
    : availability.endAt;

  // Validate duration if times are provided
  const durationMinutes =
    (newEndAt.getTime() - newStartAt.getTime()) / (60 * 1000);
  if (
    durationMinutes < AVAILABILITY_MIN_DURATION_MINUTES ||
    durationMinutes > AVAILABILITY_MAX_DURATION_MINUTES
  ) {
    throw new HttpError(
      400,
      `Availability must last between ${AVAILABILITY_MIN_DURATION_MINUTES} and ${AVAILABILITY_MAX_DURATION_MINUTES} minutes`,
    );
  }

  // If startAt is updated and changed, enforce lead time
  if (
    payload.startAt &&
    newStartAt.getTime() !== availability.startAt.getTime()
  ) {
    const minStart =
      now.getTime() + AVAILABILITY_MIN_LEAD_TIME_HOURS * 60 * 60 * 1000;
    if (newStartAt.getTime() < minStart) {
      throw new HttpError(
        400,
        `Availability must start at least ${AVAILABILITY_MIN_LEAD_TIME_HOURS} hours from now`,
      );
    }
  }

  const execute = async (client: RepositoryContext) => {
    await repo.acquireTeamAvailabilityLock(availability.teamId, client);

    const existing = await repo.listAvailabilityByTeams(
      [availability.teamId],
      { statuses: ["OPEN"] },
      client,
    );
    assertNoOpenOverlap(
      { startAt: newStartAt, endAt: newEndAt },
      existing,
      availability.id,
    );

    const updated = await repo.updateAvailability(
      availability.id,
      {
        format: payload.format,
        startAt: newStartAt,
        endAt: newEndAt,
        originLat: payload.origin?.lat,
        originLng: payload.origin?.lng,
        radiusKm: payload.radiusKm,
        eloTolerance: payload.eloTolerance,
        message: payload.message !== undefined ? payload.message : undefined,
        expiresAt: newStartAt,
      },
      client,
    );

    return toTeamAvailability(updated);
  };

  try {
    if (tx) {
      return await execute(tx);
    }
    return await withTransaction(execute);
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      throw err;
    }
    const errMessage = err instanceof Error ? err.message : String(err);
    const errCode = (err as { code?: string })?.code;
    if (
      errCode === "P2002" ||
      errCode === "P2010" ||
      errMessage.includes("team_availabilities_no_overlapping_open") ||
      errMessage.includes("exclusion")
    ) {
      throw new HttpError(
        409,
        "Team already has an open availability that overlaps with this time window",
      );
    }
    throw err;
  }
}

/**
 * Cancels a team availability.
 * Only the active captain can cancel.
 * Cancellation is idempotent; MATCHED availability cannot be cancelled through this command.
 */
export async function cancelAvailability(
  actorId: string,
  id: string,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<TeamAvailability> {
  const availability = await repo.findAvailabilityById(id, tx);
  if (!availability) {
    throw new HttpError(404, "Availability not found");
  }

  await teamsService.assertActiveCaptain(availability.teamId, actorId);
  assertCanCancelAvailability(availability.status);

  if (availability.status === "CANCELLED") {
    return toTeamAvailability(availability);
  }

  const updated = await repo.updateAvailability(
    id,
    { status: "CANCELLED", cancelledAt: now },
    tx,
  );

  return toTeamAvailability(updated);
}

/**
 * Marks due OPEN availabilities as EXPIRED (when endAt or expiresAt is past now).
 * Idempotent.
 */
export async function expireDueAvailability(
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<{ count: number }> {
  return repo.expireDueAvailabilities(now, tx);
}

/**
 * Returns eligible recommended opponents for an availability window.
 * Requires the availability team's active captain.
 * Results are sorted by score descending, then distance ascending, then team ID for deterministic ties.
 * Results are paginated.
 */
export async function getRecommendations(
  actorId: string,
  availabilityId: string,
  query: PaginationQuery = { page: 1, pageSize: 20 },
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<PaginatedRecommendations> {
  // 1. Expire due availabilities before computing recommendations so DB status is fresh
  await expireDueAvailability(now, tx);

  const searching = await repo.findAvailabilityById(availabilityId, tx);
  if (!searching) {
    throw new HttpError(404, "Availability not found");
  }

  // 2. Authorize: requires the availability team's active captain
  await teamsService.assertActiveCaptain(searching.teamId, actorId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  // 3. If searching availability is not OPEN or is past its deadline, return empty recommendations
  const isDue =
    searching.endAt.getTime() <= now.getTime() ||
    searching.expiresAt.getTime() <= now.getTime();
  if (searching.status !== "OPEN" || isDue) {
    return { items: [], page, pageSize, total: 0 };
  }

  // 4. Retrieve searching team, searching rating, and candidate availabilities in parallel
  const [searchingTeam, searchingRating, candidates] = await Promise.all([
    teamsService.getTeam(searching.teamId),
    ratingsService.getTeamRating(searching.teamId, tx),
    repo.findCandidateAvailabilities(
      {
        excludeTeamId: searching.teamId,
        format: searching.format,
        startAt: searching.startAt,
        endAt: searching.endAt,
      },
      tx,
    ),
  ]);

  const searchingElo = searchingRating.rating;
  const searchingHasCaptain = searchingTeam.members.some(
    (m) => m.teamRole === "CAPTAIN" || m.role === "CAPTAIN",
  );

  if (searchingTeam.status !== "ACTIVE" || !searchingHasCaptain) {
    return { items: [], page, pageSize, total: 0 };
  }

  // 5. Batch retrieve candidate teams and ratings in single queries (O(1) queries)
  const candidateTeamIds = Array.from(new Set(candidates.map((c) => c.teamId)));
  const [candidateTeamsMap, candidateRatingsMap] = await Promise.all([
    teamsService.getTeamsBatch(candidateTeamIds),
    ratingsService.getTeamRatingsBatch(candidateTeamIds, tx),
  ]);

  const eligible: OpponentRecommendation[] = [];

  for (const candidate of candidates) {
    const candidateTeam = candidateTeamsMap.get(candidate.teamId);
    if (!candidateTeam) {
      continue;
    }

    const candidateRating = candidateRatingsMap.get(candidate.teamId);
    const candidateElo = candidateRating?.rating ?? candidateTeam.skillRating ?? 1000;
    const candidateHasCaptain = candidateTeam.members.some(
      (m) => m.teamRole === "CAPTAIN" || m.role === "CAPTAIN",
    );

    const check = checkRecommendationEligibility(
      {
        team: {
          id: searching.teamId,
          isActive: searchingTeam.status === "ACTIVE",
          hasActiveCaptain: searchingHasCaptain,
          elo: searchingElo,
        },
        availability: {
          status: searching.status,
          format: searching.format,
          startAt: searching.startAt,
          endAt: searching.endAt,
          origin: { lat: searching.originLat, lng: searching.originLng },
          radiusKm: searching.radiusKm,
          eloTolerance: searching.eloTolerance,
        },
      },
      {
        team: {
          id: candidateTeam.id,
          isActive: candidateTeam.status === "ACTIVE",
          hasActiveCaptain: candidateHasCaptain,
          elo: candidateElo,
        },
        availability: {
          status: candidate.status,
          format: candidate.format,
          startAt: candidate.startAt,
          endAt: candidate.endAt,
          origin: { lat: candidate.originLat, lng: candidate.originLng },
          radiusKm: candidate.radiusKm,
          eloTolerance: candidate.eloTolerance,
        },
      },
    );

    if (!check.eligible) {
      continue;
    }

    const diff = check.eloDifference!;
    const dist = check.distanceKm!;
    const mutualTol = check.mutualEloTolerance!;
    const mutualRad = check.mutualRadiusKm!;

    const score = scoreRecommendation({
      eloDifference: diff,
      mutualEloTolerance: mutualTol,
      distanceKm: dist,
      mutualRadiusKm: mutualRad,
    });

    const roundedDistance = Math.round(dist * 10) / 10;
    const overlapStart = new Date(
      Math.max(searching.startAt.getTime(), candidate.startAt.getTime()),
    ).toISOString();
    const overlapEnd = new Date(
      Math.min(searching.endAt.getTime(), candidate.endAt.getTime()),
    ).toISOString();
    const overlapMins = check.overlapMinutes!;

    const eloScore =
      mutualTol > 0 ? Math.max(0, 1 - Math.min(diff / mutualTol, 1)) : 0;
    const distanceScore =
      mutualRad > 0 ? Math.max(0, 1 - Math.min(dist / mutualRad, 1)) : 0;

    const teamSummary: RecommendedTeamSummary = {
      id: candidateTeam.id,
      name: candidateTeam.name,
      logoUrl: candidateTeam.logoUrl,
      elo: candidateElo,
    };

    eligible.push({
      availabilityId: candidate.id,
      team: teamSummary,
      teamSummary,
      overlappingWindow: {
        startAt: overlapStart,
        endAt: overlapEnd,
        durationMinutes: overlapMins,
      },
      format: candidate.format,
      distanceKm: roundedDistance,
      eloDifference: diff,
      score,
      explanation: {
        eloDifference: diff,
        distanceKm: roundedDistance,
        format: candidate.format,
        overlapMinutes: overlapMins,
        opponentReliability: null,
        eloScore,
        distanceScore,
      },
      reliability: null,
    });
  }

  // 6. Sort score descending, then distance ascending, then team ID for deterministic ties
  eligible.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    const teamCmp = a.team.id.localeCompare(b.team.id);
    if (teamCmp !== 0) {
      return teamCmp;
    }
    return a.availabilityId.localeCompare(b.availabilityId);
  });

  // 7. Paginate
  const total = eligible.length;
  const startIdx = (page - 1) * pageSize;
  const items = eligible.slice(startIdx, startIdx + pageSize);

  return { items, page, pageSize, total };
}
