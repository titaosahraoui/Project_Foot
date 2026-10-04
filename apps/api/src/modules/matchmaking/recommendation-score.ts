import type { Coordinates } from "@footconnect/shared";

export const EARTH_RADIUS_KM = 6371;

export interface ScoreRecommendationInput {
  eloDifference: number;
  mutualEloTolerance: number;
  distanceKm: number;
  mutualRadiusKm: number;
}

export interface TeamEligibilityContext {
  id: string;
  isActive: boolean;
  hasActiveCaptain: boolean;
  elo: number;
}

export interface AvailabilityEligibilityContext {
  status: string;
  format: string;
  startAt: Date | string | number;
  endAt: Date | string | number;
  origin: Coordinates;
  radiusKm: number;
  eloTolerance: number;
}

export interface EligibilityCandidate {
  team: TeamEligibilityContext;
  availability: AvailabilityEligibilityContext;
}

export interface RecommendationEligibilityParams {
  teamA: TeamEligibilityContext;
  availabilityA: AvailabilityEligibilityContext;
  teamB: TeamEligibilityContext;
  availabilityB: AvailabilityEligibilityContext;
}

export type RecommendationIneligibilityReason =
  | "SAME_TEAM"
  | "TEAM_INACTIVE"
  | "MISSING_CAPTAIN"
  | "AVAILABILITY_NOT_OPEN"
  | "FORMAT_MISMATCH"
  | "NO_OVERLAP"
  | "DISTANCE_EXCEEDS_RADIUS"
  | "ELO_DIFF_EXCEEDS_TOLERANCE";

export interface RecommendationEligibilityResult {
  eligible: boolean;
  reason?: RecommendationIneligibilityReason;
  distanceKm?: number;
  overlapMinutes?: number;
  eloDifference?: number;
  mutualRadiusKm?: number;
  mutualEloTolerance?: number;
}

/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula, returning distance in kilometres.
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  if (a.lat === b.lat && a.lng === b.lng) {
    return 0;
  }

  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const h =
    sinDLat2 * sinDLat2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng2 *
      sinDLng2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function toEpochMs(val: Date | string | number): number {
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  return Date.parse(val);
}

/**
 * Calculates the number of overlapping minutes between two time windows.
 * Windows are considered half-open [startAt, endAt), so touching boundaries (adjacent windows)
 * yield 0 minutes of overlap.
 */
export function overlapMinutes(
  aStart: Date | string | number,
  aEnd: Date | string | number,
  bStart: Date | string | number,
  bEnd: Date | string | number,
): number {
  const startA = toEpochMs(aStart);
  const endA = toEpochMs(aEnd);
  const startB = toEpochMs(bStart);
  const endB = toEpochMs(bEnd);

  if (
    Number.isNaN(startA) ||
    Number.isNaN(endA) ||
    Number.isNaN(startB) ||
    Number.isNaN(endB)
  ) {
    return 0;
  }

  if (endA <= startA || endB <= startB) {
    return 0;
  }

  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);

  const diffMs = overlapEnd - overlapStart;
  if (diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / (60 * 1000));
}

/**
 * Calculates an explainable recommendation score from 0 to 100 based on:
 * - 65% Elo similarity: 1 - min(|diff| / mutualTolerance, 1)
 * - 35% distance proximity: 1 - min(distance / mutualRadius, 1)
 * Score = Math.round(100 * (0.65 * elo + 0.35 * distance))
 *
 * Reliability is deliberately NOT a score input.
 */
export function scoreRecommendation({
  eloDifference,
  mutualEloTolerance,
  distanceKm,
  mutualRadiusKm,
}: ScoreRecommendationInput): number {
  const diff = Math.abs(eloDifference);
  const distance = Math.max(0, distanceKm);

  const eloComponent =
    mutualEloTolerance > 0
      ? Math.max(0, 1 - Math.min(diff / mutualEloTolerance, 1))
      : 0;

  const distanceComponent =
    mutualRadiusKm > 0
      ? Math.max(0, 1 - Math.min(distance / mutualRadiusKm, 1))
      : 0;

  const weightedSum = 0.65 * eloComponent + 0.35 * distanceComponent;
  return Math.round(100 * weightedSum);
}

/**
 * Checks whether two teams and their availabilities are eligible for a recommendation match,
 * providing the detailed reason and computed values.
 */
export function checkRecommendationEligibility(
  candidateA: EligibilityCandidate,
  candidateB: EligibilityCandidate,
): RecommendationEligibilityResult {
  // 1. Different teams
  if (candidateA.team.id === candidateB.team.id) {
    return { eligible: false, reason: "SAME_TEAM" };
  }

  // 2. Both teams active
  if (!candidateA.team.isActive || !candidateB.team.isActive) {
    return { eligible: false, reason: "TEAM_INACTIVE" };
  }

  // 3. Both teams have an active captain
  if (!candidateA.team.hasActiveCaptain || !candidateB.team.hasActiveCaptain) {
    return { eligible: false, reason: "MISSING_CAPTAIN" };
  }

  // 4. Both availabilities are OPEN
  if (
    candidateA.availability.status !== "OPEN" ||
    candidateB.availability.status !== "OPEN"
  ) {
    return { eligible: false, reason: "AVAILABILITY_NOT_OPEN" };
  }

  // 5. Match format exact match
  if (candidateA.availability.format !== candidateB.availability.format) {
    return { eligible: false, reason: "FORMAT_MISMATCH" };
  }

  // 6. Overlapping availability windows
  const overlap = overlapMinutes(
    candidateA.availability.startAt,
    candidateA.availability.endAt,
    candidateB.availability.startAt,
    candidateB.availability.endAt,
  );
  if (overlap <= 0) {
    return { eligible: false, reason: "NO_OVERLAP", overlapMinutes: 0 };
  }

  // 7. Distance within min(radiusA, radiusB)
  const mutualRadius = Math.min(
    candidateA.availability.radiusKm,
    candidateB.availability.radiusKm,
  );
  const distance = haversineKm(
    candidateA.availability.origin,
    candidateB.availability.origin,
  );
  if (distance > mutualRadius) {
    return {
      eligible: false,
      reason: "DISTANCE_EXCEEDS_RADIUS",
      distanceKm: distance,
      mutualRadiusKm: mutualRadius,
      overlapMinutes: overlap,
    };
  }

  // 8. Elo difference within min(toleranceA, toleranceB)
  const mutualTolerance = Math.min(
    candidateA.availability.eloTolerance,
    candidateB.availability.eloTolerance,
  );
  const eloDiff = Math.abs(candidateA.team.elo - candidateB.team.elo);
  if (eloDiff > mutualTolerance) {
    return {
      eligible: false,
      reason: "ELO_DIFF_EXCEEDS_TOLERANCE",
      eloDifference: eloDiff,
      mutualEloTolerance: mutualTolerance,
      distanceKm: distance,
      mutualRadiusKm: mutualRadius,
      overlapMinutes: overlap,
    };
  }

  return {
    eligible: true,
    distanceKm: distance,
    overlapMinutes: overlap,
    eloDifference: eloDiff,
    mutualRadiusKm: mutualRadius,
    mutualEloTolerance: mutualTolerance,
  };
}

/**
 * Simple boolean check for recommendation eligibility.
 * Accepts either two candidates or a single unified params object.
 */
export function isRecommendationEligible(
  aOrParams: EligibilityCandidate | RecommendationEligibilityParams,
  maybeB?: EligibilityCandidate,
): boolean {
  if (maybeB) {
    return checkRecommendationEligibility(
      aOrParams as EligibilityCandidate,
      maybeB,
    ).eligible;
  }
  const params = aOrParams as RecommendationEligibilityParams;
  return checkRecommendationEligibility(
    { team: params.teamA, availability: params.availabilityA },
    { team: params.teamB, availability: params.availabilityB },
  ).eligible;
}
