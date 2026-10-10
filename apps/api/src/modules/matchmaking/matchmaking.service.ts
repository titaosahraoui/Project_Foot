import { z } from "zod";
import type {
  MatchChallenge as MatchChallengeRecord,
  TeamAvailability as TeamAvailabilityRecord,
} from "@prisma/client";
import {
  AVAILABILITY_MAX_DURATION_MINUTES,
  AVAILABILITY_MIN_DURATION_MINUTES,
  AVAILABILITY_MIN_LEAD_TIME_HOURS,
  buildCreateTeamAvailabilitySchema,
  buildUpdateTeamAvailabilitySchema,
  calculateChallengeBookingDeadline,
  calculateChallengeResponseDeadline,
  createMatchChallengeSchema,
  matchChallengeDetailSchema,
  matchChallengeResponseSchema,
  matchChallengeSummarySchema,
  toApproximateArea,
  type ChallengeAction,
  type CreateMatchChallengeInput,
  type CreateTeamAvailabilityInput,
  type MatchChallengeDetail,
  type MatchChallengeResponse,
  type MatchChallengeSummary,
  type MatchChallengesQuery,
  type OpponentRecommendation,
  type PaginatedMatchChallenges,
  type PaginatedRecommendations,
  type PaginationQuery,
  type PublicTeamAvailability,
  type RecommendedTeamSummary,
  type TeamAvailability,
  type UpdateTeamAvailabilityInput,
} from "@footconnect/shared";
import {
  hashIdempotencyRequest,
  readIdempotentResult,
  storeIdempotentResult,
} from "../../lib/idempotency";
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

// ---------------------------------------------------------------------------
// Match Challenge Lifecycle (Milestone 07)
// ---------------------------------------------------------------------------

export function toMatchChallengeResponse(
  record: MatchChallengeRecord,
): MatchChallengeResponse {
  const result: MatchChallengeResponse = {
    id: record.id,
    challengerTeamId: record.challengerTeamId,
    opponentTeamId: record.opponentTeamId,
    challengerAvailabilityId: record.challengerAvailabilityId,
    opponentAvailabilityId: record.opponentAvailabilityId,
    organizerUserId: record.organizerUserId,
    format: record.format,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    approximateArea: toApproximateArea({
      lat: record.originLat,
      lng: record.originLng,
    }),
    radiusKm: record.radiusKm,
    responseDeadline: record.responseDeadline.toISOString(),
    bookingDeadline: isoOrNull(record.bookingDeadline),
    status: record.status,
    message: record.message ?? null,
    respondedAt: isoOrNull(record.respondedAt),
    cancelledAt: isoOrNull(record.cancelledAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
  return matchChallengeResponseSchema.parse(result);
}

function isZodError(
  error: unknown,
): error is z.ZodError | { name: "ZodError"; issues: z.ZodIssue[] } {
  if (error instanceof z.ZodError) return true;
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; issues?: unknown };
  return candidate.name === "ZodError" && Array.isArray(candidate.issues);
}

/**
 * Creates a match challenge between two open, eligible availability windows.
 * Requires actor to captain the challenger. Opponent must have an active captain.
 * Computes canonical overlap snapshot and locked response deadline.
 * Idempotent: repeated calls with matching input return the same challenge.
 * Does not modify availability rows on send.
 */
export async function createChallenge(
  actorId: string,
  input: CreateMatchChallengeInput,
  now: Date = new Date(),
  txOrIdempotencyKey?: RepositoryContext | string,
  maybeIdempotencyKey?: string,
): Promise<MatchChallengeResponse> {
  let tx: RepositoryContext | undefined;
  let idempotencyKey: string | undefined;

  if (typeof txOrIdempotencyKey === "string") {
    idempotencyKey = txOrIdempotencyKey;
  } else {
    tx = txOrIdempotencyKey;
    idempotencyKey = maybeIdempotencyKey;
  }

  let parsedInput: CreateMatchChallengeInput;
  try {
    parsedInput = createMatchChallengeSchema.parse(input);
  } catch (err) {
    if (isZodError(err)) {
      throw new HttpError(
        422,
        err.issues.map((i) => i.message).join("; "),
        "CONDITIONS_VIOLATION",
        { issues: err.issues },
      );
    }
    throw err;
  }

  // 1. Check idempotency record first (fast return on retry)
  const scope = "matchmaking:challenge:create";
  const key =
    idempotencyKey ??
    `${parsedInput.challengerAvailabilityId}:${parsedInput.opponentAvailabilityId}`;
  const requestPayload = {
    actorId,
    challengerAvailabilityId: parsedInput.challengerAvailabilityId,
    opponentAvailabilityId: parsedInput.opponentAvailabilityId,
    message: parsedInput.message ?? null,
  };
  const requestHash = hashIdempotencyRequest(requestPayload);

  const cached = await readIdempotentResult(actorId, scope, key);
  if (cached) {
    if (cached.requestHash !== requestHash) {
      throw new HttpError(
        409,
        "Idempotency key was already used for a different request",
        "CONFLICT",
        { scope, key },
      );
    }
    return cached.responseBody as MatchChallengeResponse;
  }

  // 2. Fetch both availability rows
  let [challengerAvail, opponentAvail] = await Promise.all([
    repo.findAvailabilityById(parsedInput.challengerAvailabilityId, tx),
    repo.findAvailabilityById(parsedInput.opponentAvailabilityId, tx),
  ]);

  if (!challengerAvail || !opponentAvail) {
    throw new HttpError(404, "Availability not found");
  }

  // 3. Authorize actor: actor must be active captain of the challenger team
  await teamsService.assertActiveCaptain(challengerAvail.teamId, actorId);

  // 4. Reject self-challenge
  if (
    challengerAvail.teamId === opponentAvail.teamId ||
    (parsedInput.opponentTeamId &&
      parsedInput.opponentTeamId === challengerAvail.teamId) ||
    (parsedInput.challengerTeamId &&
      parsedInput.opponentTeamId &&
      parsedInput.challengerTeamId === parsedInput.opponentTeamId)
  ) {
    throw new HttpError(
      422,
      "Cannot challenge own team",
      "CONDITIONS_VIOLATION",
    );
  }

  if (
    parsedInput.challengerTeamId &&
    parsedInput.challengerTeamId !== challengerAvail.teamId
  ) {
    throw new HttpError(
      422,
      "Challenger team does not match availability",
      "CONDITIONS_VIOLATION",
    );
  }
  if (
    parsedInput.opponentTeamId &&
    parsedInput.opponentTeamId !== opponentAvail.teamId
  ) {
    throw new HttpError(
      422,
      "Opponent team does not match availability",
      "CONDITIONS_VIOLATION",
    );
  }

  // 5. Verify both availability rows are OPEN and not expired (stale recommendation)
  if (challengerAvail.status !== "OPEN" || opponentAvail.status !== "OPEN") {
    throw new HttpError(
      409,
      "Availability window is no longer open",
      "CONFLICT",
    );
  }

  if (
    challengerAvail.endAt.getTime() <= now.getTime() ||
    challengerAvail.expiresAt.getTime() <= now.getTime() ||
    opponentAvail.endAt.getTime() <= now.getTime() ||
    opponentAvail.expiresAt.getTime() <= now.getTime()
  ) {
    throw new HttpError(
      409,
      "Availability window has expired",
      "CONFLICT",
    );
  }

  const execute = async (client: RepositoryContext) => {
    // Lock the same two availability rows in deterministic order used by
    // acceptance, then reload them. Recommendations are only a snapshot.
    const sortedAvailabilityIds = [
      parsedInput.challengerAvailabilityId,
      parsedInput.opponentAvailabilityId,
    ].sort();
    for (const availabilityId of sortedAvailabilityIds) {
      await repo.acquireAvailabilityLock(availabilityId, client);
    }

    [challengerAvail, opponentAvail] = await Promise.all([
      repo.findAvailabilityById(parsedInput.challengerAvailabilityId, client),
      repo.findAvailabilityById(parsedInput.opponentAvailabilityId, client),
    ]);
    if (!challengerAvail || !opponentAvail) {
      throw new HttpError(404, "Availability not found");
    }

    await teamsService.assertActiveCaptain(challengerAvail.teamId, actorId);

    if (
      challengerAvail.teamId === opponentAvail.teamId ||
      (parsedInput.opponentTeamId &&
        parsedInput.opponentTeamId === challengerAvail.teamId) ||
      (parsedInput.challengerTeamId &&
        parsedInput.opponentTeamId &&
        parsedInput.challengerTeamId === parsedInput.opponentTeamId)
    ) {
      throw new HttpError(422, "Cannot challenge own team", "CONDITIONS_VIOLATION");
    }
    if (
      parsedInput.challengerTeamId &&
      parsedInput.challengerTeamId !== challengerAvail.teamId
    ) {
      throw new HttpError(422, "Challenger team does not match availability", "CONDITIONS_VIOLATION");
    }
    if (
      parsedInput.opponentTeamId &&
      parsedInput.opponentTeamId !== opponentAvail.teamId
    ) {
      throw new HttpError(422, "Opponent team does not match availability", "CONDITIONS_VIOLATION");
    }
    if (challengerAvail.status !== "OPEN" || opponentAvail.status !== "OPEN") {
      throw new HttpError(409, "Availability window is no longer open", "CONFLICT");
    }
    if (
      challengerAvail.endAt.getTime() <= now.getTime() ||
      challengerAvail.expiresAt.getTime() <= now.getTime() ||
      opponentAvail.endAt.getTime() <= now.getTime() ||
      opponentAvail.expiresAt.getTime() <= now.getTime()
    ) {
      throw new HttpError(409, "Availability window has expired", "CONFLICT");
    }

    const [challengerTeam, opponentTeam] = await Promise.all([
      teamsService.getTeam(challengerAvail.teamId),
      teamsService.getTeam(opponentAvail.teamId),
    ]);
    const [challengerRating, opponentRating] = await Promise.all([
      ratingsService.getTeamRating(challengerAvail.teamId, client),
      ratingsService.getTeamRating(opponentAvail.teamId, client),
    ]);
    if (challengerTeam.status !== "ACTIVE" || opponentTeam.status !== "ACTIVE") {
      throw new HttpError(422, "Both teams must be active", "CONDITIONS_VIOLATION");
    }
    const lockedOpponentHasCaptain = opponentTeam.members.some(
      (m) => m.teamRole === "CAPTAIN" || m.role === "CAPTAIN",
    );
    if (!lockedOpponentHasCaptain) {
      throw new HttpError(422, "Opponent team has no active captain", "CONDITIONS_VIOLATION");
    }
    const lockedEligibility = checkRecommendationEligibility(
      {
        team: { id: challengerTeam.id, isActive: true, hasActiveCaptain: true, elo: challengerRating.rating },
        availability: {
          status: challengerAvail.status,
          format: challengerAvail.format,
          startAt: challengerAvail.startAt,
          endAt: challengerAvail.endAt,
          origin: { lat: challengerAvail.originLat, lng: challengerAvail.originLng },
          radiusKm: challengerAvail.radiusKm,
          eloTolerance: challengerAvail.eloTolerance,
        },
      },
      {
        team: { id: opponentTeam.id, isActive: true, hasActiveCaptain: lockedOpponentHasCaptain, elo: opponentRating.rating },
        availability: {
          status: opponentAvail.status,
          format: opponentAvail.format,
          startAt: opponentAvail.startAt,
          endAt: opponentAvail.endAt,
          origin: { lat: opponentAvail.originLat, lng: opponentAvail.originLng },
          radiusKm: opponentAvail.radiusKm,
          eloTolerance: opponentAvail.eloTolerance,
        },
      },
    );
    if (!lockedEligibility.eligible) {
      throw new HttpError(422, `Incompatible match conditions: ${lockedEligibility.reason}`, "CONDITIONS_VIOLATION");
    }

    const overlapStart = new Date(
      Math.max(challengerAvail.startAt.getTime(), opponentAvail.startAt.getTime()),
    );
    const overlapEnd = new Date(
      Math.min(challengerAvail.endAt.getTime(), opponentAvail.endAt.getTime()),
    );
    const responseDeadline = calculateChallengeResponseDeadline(now, overlapStart);
    if (responseDeadline.getTime() <= now.getTime()) {
      throw new HttpError(
        422,
        "Challenge response deadline must be in the future",
        "CONDITIONS_VIOLATION",
      );
    }

    // Double-check idempotency record inside transaction
    const inTxCached = await readIdempotentResult(actorId, scope, key);
    if (inTxCached) {
      if (inTxCached.requestHash !== requestHash) {
        throw new HttpError(
          409,
          "Idempotency key was already used for a different request",
          "CONFLICT",
          { scope, key },
        );
      }
      return inTxCached.responseBody as MatchChallengeResponse;
    }

    // Check duplicate pending challenge between these availability rows
    const existingPending = await repo.findPendingChallengeByAvailabilities(
      challengerAvail.id,
      opponentAvail.id,
      client,
    );
    if (existingPending) {
      throw new HttpError(
        409,
        "A pending challenge already exists between these availability windows",
        "CONFLICT",
      );
    }

    // Persist challenge: snapshotted agreed conditions, responseDeadline computed, bookingDeadline null.
    // Note: Availability state is NOT modified on send.
    const created = await repo.createChallenge(
      {
        challengerTeamId: challengerAvail.teamId,
        opponentTeamId: opponentAvail.teamId,
        challengerAvailabilityId: challengerAvail.id,
        opponentAvailabilityId: opponentAvail.id,
        organizerUserId: actorId,
        format: challengerAvail.format,
        startAt: overlapStart,
        endAt: overlapEnd,
        originLat: challengerAvail.originLat,
        originLng: challengerAvail.originLng,
        radiusKm: Math.min(challengerAvail.radiusKm, opponentAvail.radiusKm),
        responseDeadline,
        bookingDeadline: null,
        status: "PENDING",
        message: parsedInput.message ?? null,
      },
      client,
    );

    const challengeResponse = toMatchChallengeResponse(created);

    await storeIdempotentResult(
      {
        actorId,
        scope,
        key,
        requestHash,
        resourceType: "MatchChallenge",
        resourceId: created.id,
        responseStatus: 201,
        responseBody: challengeResponse,
        expiresAt: responseDeadline,
      },
      client,
    );

    return challengeResponse;
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
      errMessage.includes("match_challenges_pending_pair_unique")
    ) {
      throw new HttpError(
        409,
        "A pending challenge already exists between these availability windows",
        "CONFLICT",
      );
    }
    if (errMessage.includes("match_challenges_different_teams_check")) {
      throw new HttpError(
        422,
        "Cannot challenge own team",
        "CONDITIONS_VIOLATION",
      );
    }
    throw err;
  }
}

/**
 * Accepts a match challenge.
 * Only the opponent captain may accept.
 * Acceptance atomically:
 * - Sets both availability rows to MATCHED
 * - Stores respondedAt
 * - Computes bookingDeadline
 * - Sets every other PENDING challenge referencing either matched availability row to EXPIRED.
 * If either availability was matched by another accepted challenge, returns 409 and leaves all rows unchanged.
 * Repeat calls return the current state without duplicate side effects.
 */
export async function acceptChallenge(
  actorId: string,
  challengeId: string,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<MatchChallengeResponse> {
  const challenge = await repo.findChallengeById(challengeId, tx);
  if (!challenge) {
    throw new HttpError(404, "Challenge not found");
  }

  // Only the opponent captain accepts
  await teamsService.assertActiveCaptain(challenge.opponentTeamId, actorId);

  // Repeat commands return current state without duplicate side effects
  if (challenge.status === "ACCEPTED") {
    return toMatchChallengeResponse(challenge);
  }

  if (challenge.status !== "PENDING") {
    throw new HttpError(
      409,
      `Cannot accept challenge with status ${challenge.status}`,
      "CONFLICT",
    );
  }

  if (
    challenge.responseDeadline.getTime() <= now.getTime() ||
    challenge.startAt.getTime() <= now.getTime()
  ) {
    throw new HttpError(409, "Challenge has expired", "CONFLICT");
  }

  const execute = async (client: RepositoryContext) => {
    // Acquire deterministic advisory locks on both availability IDs
    const sortedAvailIds = [
      challenge.challengerAvailabilityId,
      challenge.opponentAvailabilityId,
    ].sort();
    for (const availId of sortedAvailIds) {
      await repo.acquireAvailabilityLock(availId, client);
    }

    // The challenge may have been declined, cancelled, or expired while this
    // request waited for the availability locks. Always decide from the row
    // read inside the transaction.
    const currentChallenge = await repo.findChallengeById(challenge.id, client);
    if (!currentChallenge) {
      throw new HttpError(404, "Challenge not found");
    }
    if (currentChallenge.status === "ACCEPTED") {
      return toMatchChallengeResponse(currentChallenge);
    }
    if (currentChallenge.status !== "PENDING") {
      throw new HttpError(
        409,
        `Cannot accept challenge with status ${currentChallenge.status}`,
        "CONFLICT",
      );
    }
    if (
      currentChallenge.responseDeadline.getTime() <= now.getTime() ||
      currentChallenge.startAt.getTime() <= now.getTime()
    ) {
      throw new HttpError(409, "Challenge has expired", "CONFLICT");
    }

    const [challengerAvail, opponentAvail] = await Promise.all([
      repo.findAvailabilityById(currentChallenge.challengerAvailabilityId, client),
      repo.findAvailabilityById(currentChallenge.opponentAvailabilityId, client),
    ]);

    if (
      !challengerAvail ||
      !opponentAvail ||
      challengerAvail.status !== "OPEN" ||
      opponentAvail.status !== "OPEN"
    ) {
      throw new HttpError(
        409,
        "Availability has already been matched or closed by another challenge",
        "CONFLICT",
      );
    }

    const bookingDeadline = calculateChallengeBookingDeadline(
      now,
      currentChallenge.startAt,
    );

    // Claim the PENDING row before changing availability. If another terminal
    // transition wins, throwing rolls back this transaction without side effects.
    const updatedChallenge = await repo.updateChallengeIfStatus(
      currentChallenge.id,
      "PENDING",
      {
        status: "ACCEPTED",
        respondedAt: now,
        bookingDeadline,
      },
      client,
    );
    if (!updatedChallenge) {
      throw new HttpError(409, "Challenge was updated by another request", "CONFLICT");
    }

    // Atomically set both availability rows MATCHED
    const matchResult = await repo.matchAvailabilities(
      [currentChallenge.challengerAvailabilityId, currentChallenge.opponentAvailabilityId],
      now,
      client,
    );

    if (matchResult.count !== 2) {
      throw new HttpError(
        409,
        "Availability has already been matched or closed by another challenge",
        "CONFLICT",
      );
    }

    // Set every other PENDING challenge referencing either matched availability row to EXPIRED
    await repo.expireOtherPendingChallenges(
      currentChallenge.id,
      [currentChallenge.challengerAvailabilityId, currentChallenge.opponentAvailabilityId],
      client,
    );

    return toMatchChallengeResponse(updatedChallenge);
  };

  if (tx) {
    return await execute(tx);
  }
  return await withTransaction(execute);
}

/**
 * Declines a match challenge.
 * Only the opponent captain may decline.
 * Repeat calls return current state without duplicate side effects.
 * Does not change unrelated rows.
 */
export async function declineChallenge(
  actorId: string,
  challengeId: string,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<MatchChallengeResponse> {
  const challenge = await repo.findChallengeById(challengeId, tx);
  if (!challenge) {
    throw new HttpError(404, "Challenge not found");
  }

  // Only the opponent captain accepts/declines
  await teamsService.assertActiveCaptain(challenge.opponentTeamId, actorId);

  // Repeat commands return current state without duplicate side effects
  if (challenge.status === "DECLINED") {
    return toMatchChallengeResponse(challenge);
  }

  if (challenge.status !== "PENDING") {
    throw new HttpError(
      409,
      `Cannot decline challenge with status ${challenge.status}`,
      "CONFLICT",
    );
  }

  if (
    challenge.responseDeadline.getTime() <= now.getTime() ||
    challenge.startAt.getTime() <= now.getTime()
  ) {
    throw new HttpError(409, "Challenge has expired", "CONFLICT");
  }

  const execute = async (client: RepositoryContext) => {
    const currentChallenge = await repo.findChallengeById(challenge.id, client);
    if (!currentChallenge) {
      throw new HttpError(404, "Challenge not found");
    }
    if (currentChallenge.status === "DECLINED") {
      return toMatchChallengeResponse(currentChallenge);
    }
    if (currentChallenge.status !== "PENDING") {
      throw new HttpError(
        409,
        `Cannot decline challenge with status ${currentChallenge.status}`,
        "CONFLICT",
      );
    }
    if (
      currentChallenge.responseDeadline.getTime() <= now.getTime() ||
      currentChallenge.startAt.getTime() <= now.getTime()
    ) {
      throw new HttpError(409, "Challenge has expired", "CONFLICT");
    }

    const updated = await repo.updateChallengeIfStatus(
      currentChallenge.id,
      "PENDING",
      { status: "DECLINED", respondedAt: now },
      client,
    );
    if (!updated) {
      throw new HttpError(409, "Challenge was updated by another request", "CONFLICT");
    }
    return toMatchChallengeResponse(updated);
  };

  if (tx) {
    return await execute(tx);
  }
  return await withTransaction(execute);
}

/**
 * Cancels a match challenge.
 * Only the organizer cancels PENDING or ACCEPTED before a confirmed booking.
 * Repeat calls return current state without duplicate side effects.
 * Does not change unrelated rows.
 */
export async function cancelChallenge(
  actorId: string,
  challengeId: string,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<MatchChallengeResponse> {
  const challenge = await repo.findChallengeById(challengeId, tx);
  if (!challenge) {
    throw new HttpError(404, "Challenge not found");
  }

  // Only the organizer cancels
  if (challenge.organizerUserId !== actorId) {
    throw new HttpError(
      403,
      "Only the challenge organizer can cancel this challenge",
      "FORBIDDEN",
    );
  }

  // Repeat commands return current state without duplicate side effects
  if (challenge.status === "CANCELLED") {
    return toMatchChallengeResponse(challenge);
  }

  if (challenge.status !== "PENDING" && challenge.status !== "ACCEPTED") {
    throw new HttpError(
      409,
      `Cannot cancel challenge with status ${challenge.status}`,
      "CONFLICT",
    );
  }

  if (challenge.status === "PENDING") {
    if (
      challenge.responseDeadline.getTime() <= now.getTime() ||
      challenge.startAt.getTime() <= now.getTime()
    ) {
      throw new HttpError(409, "Challenge has expired", "CONFLICT");
    }
  } else if (challenge.status === "ACCEPTED") {
    if (
      (challenge.bookingDeadline &&
        challenge.bookingDeadline.getTime() <= now.getTime()) ||
      challenge.startAt.getTime() <= now.getTime()
    ) {
      throw new HttpError(409, "Challenge has expired", "CONFLICT");
    }
  }

  const execute = async (client: RepositoryContext) => {
    const currentChallenge = await repo.findChallengeById(challenge.id, client);
    if (!currentChallenge) {
      throw new HttpError(404, "Challenge not found");
    }
    if (currentChallenge.status === "CANCELLED") {
      return toMatchChallengeResponse(currentChallenge);
    }
    if (currentChallenge.status !== "PENDING" && currentChallenge.status !== "ACCEPTED") {
      throw new HttpError(
        409,
        `Cannot cancel challenge with status ${currentChallenge.status}`,
        "CONFLICT",
      );
    }
    if (
      (currentChallenge.status === "PENDING" &&
        (currentChallenge.responseDeadline.getTime() <= now.getTime() ||
          currentChallenge.startAt.getTime() <= now.getTime())) ||
      (currentChallenge.status === "ACCEPTED" &&
        ((currentChallenge.bookingDeadline &&
          currentChallenge.bookingDeadline.getTime() <= now.getTime()) ||
          currentChallenge.startAt.getTime() <= now.getTime()))
    ) {
      throw new HttpError(409, "Challenge has expired", "CONFLICT");
    }

    const updated = await repo.updateChallengeIfStatus(
      currentChallenge.id,
      currentChallenge.status,
      { status: "CANCELLED", cancelledAt: now },
      client,
    );
    if (!updated) {
      throw new HttpError(409, "Challenge was updated by another request", "CONFLICT");
    }
    return toMatchChallengeResponse(updated);
  };

  if (tx) {
    return await execute(tx);
  }
  return await withTransaction(execute);
}

/**
 * Expires challenges whose response or booking deadline has passed.
 * Does not change unrelated rows.
 */
export async function expireDueChallenges(
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<{ count: number }> {
  return repo.expireDueChallenges(now, tx);
}

export function computeChallengeAvailableActions(
  challenge: MatchChallengeRecord,
  viewerId: string,
  now: Date,
  isOpponentCaptain: boolean,
): ChallengeAction[] {
  const isOrganizer = challenge.organizerUserId === viewerId;
  const isExpired =
    challenge.status === "EXPIRED" ||
    challenge.startAt.getTime() <= now.getTime() ||
    (challenge.status === "PENDING" &&
      challenge.responseDeadline.getTime() <= now.getTime()) ||
    (challenge.status === "ACCEPTED" &&
      challenge.bookingDeadline !== null &&
      challenge.bookingDeadline.getTime() <= now.getTime());

  if (
    isExpired ||
    challenge.status === "DECLINED" ||
    challenge.status === "CANCELLED"
  ) {
    return [];
  }

  const actions: ChallengeAction[] = [];
  if (challenge.status === "PENDING") {
    if (isOpponentCaptain) {
      actions.push("ACCEPT", "DECLINE");
    }
    if (isOrganizer) {
      actions.push("CANCEL");
    }
  } else if (challenge.status === "ACCEPTED") {
    if (isOrganizer) {
      actions.push("CANCEL");
    }
  }

  return actions;
}

export function toMatchChallengeSummary(
  record: MatchChallengeRecord,
  challengerTeam: RecommendedTeamSummary,
  opponentTeam: RecommendedTeamSummary,
  availableActions: ChallengeAction[],
): MatchChallengeSummary {
  return matchChallengeSummarySchema.parse({
    id: record.id,
    challengerTeamId: record.challengerTeamId,
    opponentTeamId: record.opponentTeamId,
    challengerTeam,
    opponentTeam,
    challengerAvailabilityId: record.challengerAvailabilityId,
    opponentAvailabilityId: record.opponentAvailabilityId,
    organizerUserId: record.organizerUserId,
    format: record.format,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    approximateArea: toApproximateArea({
      lat: record.originLat,
      lng: record.originLng,
    }),
    radiusKm: record.radiusKm,
    responseDeadline: record.responseDeadline.toISOString(),
    bookingDeadline: isoOrNull(record.bookingDeadline),
    status: record.status,
    message: record.message ?? null,
    respondedAt: isoOrNull(record.respondedAt),
    cancelledAt: isoOrNull(record.cancelledAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    availableActions,
  });
}

export function toMatchChallengeDetail(
  record: MatchChallengeRecord,
  challengerTeam: RecommendedTeamSummary,
  opponentTeam: RecommendedTeamSummary,
  availableActions: ChallengeAction[],
): MatchChallengeDetail {
  const summary = toMatchChallengeSummary(
    record,
    challengerTeam,
    opponentTeam,
    availableActions,
  );
  return matchChallengeDetailSchema.parse({
    ...summary,
    conditions: {
      format: record.format,
      startAt: record.startAt.toISOString(),
      endAt: record.endAt.toISOString(),
      approximateArea: summary.approximateArea,
      radiusKm: record.radiusKm,
    },
    overlappingWindow: {
      startAt: record.startAt.toISOString(),
      endAt: record.endAt.toISOString(),
      durationMinutes: Math.round(
        (record.endAt.getTime() - record.startAt.getTime()) / 60000,
      ),
    },
  });
}

/**
 * Retrieves a challenge's full detail for an authorized viewer (member of either team).
 * Computes available actions for the viewer based on role and challenge state.
 */
export async function getChallengeDetail(
  actorId: string,
  challengeId: string,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<MatchChallengeDetail> {
  // Sync expired challenges first
  await expireDueChallenges(now, tx);

  const challenge = await repo.findChallengeById(challengeId, tx);
  if (!challenge) {
    throw new HttpError(404, "Challenge not found");
  }

  const [challengerTeam, opponentTeam] = await Promise.all([
    teamsService.getTeam(challenge.challengerTeamId),
    teamsService.getTeam(challenge.opponentTeamId),
  ]);

  const isChallengerMember = challengerTeam.members.some(
    (m) => m.userId === actorId,
  );
  const isOpponentMember = opponentTeam.members.some(
    (m) => m.userId === actorId,
  );

  if (!isChallengerMember && !isOpponentMember) {
    throw new HttpError(
      403,
      "You do not have access to this challenge",
      "FORBIDDEN",
    );
  }

  const isOpponentCaptain = opponentTeam.members.some(
    (m) =>
      m.userId === actorId &&
      (m.teamRole === "CAPTAIN" || m.role === "CAPTAIN"),
  );

  const [challengerRating, opponentRating] = await Promise.all([
    ratingsService.getTeamRating(challenge.challengerTeamId, tx),
    ratingsService.getTeamRating(challenge.opponentTeamId, tx),
  ]);

  const challengerSummary: RecommendedTeamSummary = {
    id: challengerTeam.id,
    name: challengerTeam.name,
    logoUrl: challengerTeam.logoUrl,
    elo: challengerRating.rating,
  };

  const opponentSummary: RecommendedTeamSummary = {
    id: opponentTeam.id,
    name: opponentTeam.name,
    logoUrl: opponentTeam.logoUrl,
    elo: opponentRating.rating,
  };

  const availableActions = computeChallengeAvailableActions(
    challenge,
    actorId,
    now,
    isOpponentCaptain,
  );

  return toMatchChallengeDetail(
    challenge,
    challengerSummary,
    opponentSummary,
    availableActions,
  );
}

/**
 * Lists inbox challenges (challenges received by the teams the actor belongs to).
 */
export async function listInboxChallenges(
  actorId: string,
  query: MatchChallengesQuery = { page: 1, pageSize: 20 },
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<PaginatedMatchChallenges> {
  await expireDueChallenges(now, tx);

  const myTeams = await teamsService.getMyTeams(actorId);
  const myTeamIds = myTeams.map((t) => t.id);

  if (myTeamIds.length === 0) {
    return {
      items: [],
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: 0,
    };
  }

  let targetTeamIds = myTeamIds;
  if (query.teamId) {
    if (!myTeamIds.includes(query.teamId)) {
      throw new HttpError(
        403,
        "You do not have access to this team's inbox",
        "FORBIDDEN",
      );
    }
    targetTeamIds = [query.teamId];
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const { items: records, total } = await repo.findInboxChallenges(
    {
      teamIds: targetTeamIds,
      status: query.status,
      page,
      pageSize,
    },
    tx,
  );

  if (records.length === 0) {
    return { items: [], page, pageSize, total };
  }

  const allTeamIds = Array.from(
    new Set(records.flatMap((r) => [r.challengerTeamId, r.opponentTeamId])),
  );
  const [teamsMap, ratingsMap] = await Promise.all([
    teamsService.getTeamsBatch(allTeamIds),
    ratingsService.getTeamRatingsBatch(allTeamIds, tx),
  ]);

  const items: MatchChallengeSummary[] = records.map((record) => {
    const chTeam = teamsMap.get(record.challengerTeamId);
    const opTeam = teamsMap.get(record.opponentTeamId);
    const chRating = ratingsMap.get(record.challengerTeamId);
    const opRating = ratingsMap.get(record.opponentTeamId);

    const chSummary: RecommendedTeamSummary = {
      id: record.challengerTeamId,
      name: chTeam?.name ?? "Unknown Team",
      logoUrl: chTeam?.logoUrl ?? null,
      elo: chRating?.rating ?? 1200,
    };

    const opSummary: RecommendedTeamSummary = {
      id: record.opponentTeamId,
      name: opTeam?.name ?? "Unknown Team",
      logoUrl: opTeam?.logoUrl ?? null,
      elo: opRating?.rating ?? 1200,
    };

    const isOpponentCaptain =
      opTeam?.members.some(
        (m) =>
          m.userId === actorId &&
          (m.teamRole === "CAPTAIN" || m.role === "CAPTAIN"),
      ) ?? false;

    const availableActions = computeChallengeAvailableActions(
      record,
      actorId,
      now,
      isOpponentCaptain,
    );

    return toMatchChallengeSummary(
      record,
      chSummary,
      opSummary,
      availableActions,
    );
  });

  return { items, page, pageSize, total };
}

/**
 * Lists outbox challenges (challenges sent by the teams the actor belongs to).
 */
export async function listOutboxChallenges(
  actorId: string,
  query: MatchChallengesQuery = { page: 1, pageSize: 20 },
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<PaginatedMatchChallenges> {
  await expireDueChallenges(now, tx);

  const myTeams = await teamsService.getMyTeams(actorId);
  const myTeamIds = myTeams.map((t) => t.id);

  if (myTeamIds.length === 0) {
    return {
      items: [],
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: 0,
    };
  }

  let targetTeamIds = myTeamIds;
  if (query.teamId) {
    if (!myTeamIds.includes(query.teamId)) {
      throw new HttpError(
        403,
        "You do not have access to this team's outbox",
        "FORBIDDEN",
      );
    }
    targetTeamIds = [query.teamId];
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const { items: records, total } = await repo.findOutboxChallenges(
    {
      teamIds: targetTeamIds,
      status: query.status,
      page,
      pageSize,
    },
    tx,
  );

  if (records.length === 0) {
    return { items: [], page, pageSize, total };
  }

  const allTeamIds = Array.from(
    new Set(records.flatMap((r) => [r.challengerTeamId, r.opponentTeamId])),
  );
  const [teamsMap, ratingsMap] = await Promise.all([
    teamsService.getTeamsBatch(allTeamIds),
    ratingsService.getTeamRatingsBatch(allTeamIds, tx),
  ]);

  const items: MatchChallengeSummary[] = records.map((record) => {
    const chTeam = teamsMap.get(record.challengerTeamId);
    const opTeam = teamsMap.get(record.opponentTeamId);
    const chRating = ratingsMap.get(record.challengerTeamId);
    const opRating = ratingsMap.get(record.opponentTeamId);

    const chSummary: RecommendedTeamSummary = {
      id: record.challengerTeamId,
      name: chTeam?.name ?? "Unknown Team",
      logoUrl: chTeam?.logoUrl ?? null,
      elo: chRating?.rating ?? 1200,
    };

    const opSummary: RecommendedTeamSummary = {
      id: record.opponentTeamId,
      name: opTeam?.name ?? "Unknown Team",
      logoUrl: opTeam?.logoUrl ?? null,
      elo: opRating?.rating ?? 1200,
    };

    const isOpponentCaptain =
      opTeam?.members.some(
        (m) =>
          m.userId === actorId &&
          (m.teamRole === "CAPTAIN" || m.role === "CAPTAIN"),
      ) ?? false;

    const availableActions = computeChallengeAvailableActions(
      record,
      actorId,
      now,
      isOpponentCaptain,
    );

    return toMatchChallengeSummary(
      record,
      chSummary,
      opSummary,
      availableActions,
    );
  });

  return { items, page, pageSize, total };
}

/**
 * Loads a challenge by id directly from persistence.
 */
export async function getChallengeById(
  challengeId: string,
  tx?: RepositoryContext,
): Promise<MatchChallengeRecord | null> {
  return repo.findChallengeById(challengeId, tx);
}
