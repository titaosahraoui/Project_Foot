import type { TeamAvailability as TeamAvailabilityRecord } from "@prisma/client";
import {
  buildCreateTeamAvailabilitySchema,
  toApproximateArea,
  type CreateTeamAvailabilityInput,
  type OpponentRecommendation,
  type PaginatedRecommendations,
  type PaginationQuery,
  type PublicTeamAvailability,
  type RecommendedTeamSummary,
  type TeamAvailability,
} from "@footconnect/shared";
import type { RepositoryContext } from "../../lib/transaction";
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

  // 3. Enforce no overlapping OPEN windows for this team
  const existing = await repo.listAvailabilityByTeams(
    [payload.teamId],
    { statuses: ["OPEN"] },
    tx,
  );
  assertNoOpenOverlap({ startAt, endAt }, existing);

  // 4. Persist availability record
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
    tx,
  );

  return toTeamAvailability(record);
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
  const searching = await repo.findAvailabilityById(availabilityId, tx);
  if (!searching) {
    throw new HttpError(404, "Availability not found");
  }

  // 1. Authorize: requires the availability team's active captain
  await teamsService.assertActiveCaptain(searching.teamId, actorId);

  // 2. Expire due availabilities before computing recommendations
  await expireDueAvailability(now, tx);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  // 3. If searching availability is not OPEN, return empty recommendations
  if (searching.status !== "OPEN") {
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

  // 5. Fetch candidate teams and ratings concurrently
  const candidateDetails = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const [candidateTeam, candidateRating] = await Promise.all([
          teamsService.getTeam(candidate.teamId),
          ratingsService.getTeamRating(candidate.teamId, tx),
        ]);
        return { candidate, candidateTeam, candidateRating };
      } catch {
        return null;
      }
    }),
  );

  const eligible: OpponentRecommendation[] = [];

  for (const item of candidateDetails) {
    if (!item) continue;
    const { candidate, candidateTeam, candidateRating } = item;

    const candidateElo = candidateRating.rating;
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
    return a.team.id.localeCompare(b.team.id);
  });

  // 7. Paginate
  const total = eligible.length;
  const startIdx = (page - 1) * pageSize;
  const items = eligible.slice(startIdx, startIdx + pageSize);

  return { items, page, pageSize, total };
}
