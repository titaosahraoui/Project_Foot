import type { TeamAvailability as TeamAvailabilityRecord } from "@prisma/client";
import {
  buildCreateTeamAvailabilitySchema,
  toApproximateArea,
  type CreateTeamAvailabilityInput,
  type PublicTeamAvailability,
  type TeamAvailability,
} from "@footconnect/shared";
import type { RepositoryContext } from "../../lib/transaction";
import { HttpError } from "../../middleware/error-handler";
import * as teamsService from "../teams/teams.service";
import {
  assertCanCancelAvailability,
  assertNoOpenOverlap,
} from "./availability-rules";
import * as repo from "./matchmaking.repository";

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
