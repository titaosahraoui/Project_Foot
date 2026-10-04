import type { TeamAvailability as TeamAvailabilityRecord } from "@prisma/client";
import {
  toApproximateArea,
  type PublicTeamAvailability,
  type TeamAvailability,
} from "@footconnect/shared";

// Public surface of the matchmaking module. M06-T01 only defines the
// persistence contract and response mapping; lifecycle rules (create/cancel/
// expire) arrive in M06-T02 and recommendations in M06-T03/T04.

function approximateAreaOf(record: TeamAvailabilityRecord) {
  return toApproximateArea({ lat: record.originLat, lng: record.originLng });
}

function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Own-team view. Raw origin coordinates are replaced by an approximate area. */
export function toTeamAvailability(record: TeamAvailabilityRecord): TeamAvailability {
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
