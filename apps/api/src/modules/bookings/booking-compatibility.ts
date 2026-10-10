import type {
  AvailableSlot,
  BlockingRange,
  ChallengeStatus,
  Coordinates,
  MatchFormat,
  PitchAvailabilityRule,
  PitchBlock,
  PitchSize,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import { computeAvailableSlots } from "../pitches/inventory";
import { haversineKm } from "../matchmaking/recommendation-score";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AcceptedChallengeContext {
  status: ChallengeStatus | string;
  bookingDeadline: Date | string | null;
  organizerUserId: string;
  challengerTeamId: string;
  format: MatchFormat | string;
  startAt: Date | string;
  endAt: Date | string;
  originLat: number;
  originLng: number;
  radiusKm: number;
}

export interface PitchContext {
  id: string;
  isActive: boolean;
  size: PitchSize | string;
  lat: number;
  lng: number;
  priceAmountMinor: number;
  currency: string;
  availabilityRules?: PitchAvailabilityRule[];
  blocks?: PitchBlock[];
}

export interface ChallengerMembershipContext {
  userId: string;
  role: string;
  teamRole?: string;
  status?: string;
}

export interface AssertBookingCompatibleInput {
  challenge: AcceptedChallengeContext;
  actorId: string;
  isChallengerCaptain?: boolean;
  challengerMemberships?: ChallengerMembershipContext[];
  requestedStartAt?: Date | string;
  requestedEndAt?: Date | string;
  startAt?: Date | string;
  endAt?: Date | string;
  pitch: PitchContext;
  availableSlots?: AvailableSlot[];
  extraBlocks?: BlockingRange[];
  now?: Date;
}

export interface BookingCompatibilityResult {
  compatible: true;
  priceAmountMinor: number;
  currency: string;
  distanceKm: number;
  durationMinutes: number;
  slot: AvailableSlot;
}

const MINUTE_MS = 60 * 1000;
const EPSILON_KM = 1e-9;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Validates that a requested booking strictly complies with the agreed challenge terms,
 * actor permissions, and pitch inventory availability.
 *
 * Failure modes:
 * - 409 STATE_CONFLICT: Challenge is not ACCEPTED or booking deadline has passed.
 * - 422 CONDITIONS_VIOLATION: Agreement mismatch (actor, time window, duration, format, distance, pitch active state).
 * - 409 INVENTORY_CONFLICT: Requested slot is not produced by pitch inventory or is blocked.
 */
export function assertBookingCompatible(
  input: AssertBookingCompatibleInput,
): BookingCompatibilityResult {
  const now = input.now ?? new Date();
  const { challenge, pitch, actorId } = input;

  // 1. Challenge must be ACCEPTED and before bookingDeadline
  if (challenge.status !== "ACCEPTED") {
    throw new HttpError(
      409,
      `Challenge is not in ACCEPTED status (current: ${challenge.status})`,
      "STATE_CONFLICT",
    );
  }

  if (!challenge.bookingDeadline) {
    throw new HttpError(
      409,
      "Challenge has no active booking deadline",
      "STATE_CONFLICT",
    );
  }

  const deadlineDate = new Date(challenge.bookingDeadline);
  if (now.getTime() >= deadlineDate.getTime()) {
    throw new HttpError(
      409,
      "Challenge booking deadline has passed",
      "STATE_CONFLICT",
    );
  }

  // 2. Actor is organizer and still active challenger captain
  if (actorId !== challenge.organizerUserId) {
    throw new HttpError(
      422,
      "Actor is not the agreed challenge organizer",
      "CONDITIONS_VIOLATION",
    );
  }

  if (input.isChallengerCaptain !== undefined) {
    if (!input.isChallengerCaptain) {
      throw new HttpError(
        422,
        "Actor is not an active captain of the challenger team",
        "CONDITIONS_VIOLATION",
      );
    }
  } else if (input.challengerMemberships && input.challengerMemberships.length > 0) {
    const isCaptain = input.challengerMemberships.some(
      (m) =>
        m.userId === actorId &&
        (m.role === "CAPTAIN" || m.teamRole === "CAPTAIN") &&
        (!m.status || m.status === "ACTIVE"),
    );
    if (!isCaptain) {
      throw new HttpError(
        422,
        "Actor is not an active captain of the challenger team",
        "CONDITIONS_VIOLATION",
      );
    }
  } else {
    throw new HttpError(
      422,
      "Actor is not an active captain of the challenger team",
      "CONDITIONS_VIOLATION",
    );
  }

  // Parse requested time window
  const rawStart = input.requestedStartAt ?? input.startAt;
  const rawEnd = input.requestedEndAt ?? input.endAt;

  if (!rawStart || !rawEnd) {
    throw new HttpError(
      422,
      "Requested start and end times are required",
      "CONDITIONS_VIOLATION",
    );
  }

  const reqStart = new Date(rawStart);
  const reqEnd = new Date(rawEnd);

  if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
    throw new HttpError(
      422,
      "Invalid requested start or end timestamp",
      "CONDITIONS_VIOLATION",
    );
  }

  if (reqEnd.getTime() <= reqStart.getTime()) {
    throw new HttpError(
      422,
      "Requested end time must be strictly after start time",
      "CONDITIONS_VIOLATION",
    );
  }

  // 3. Requested start/end are inside the accepted window
  const challengeStart = new Date(challenge.startAt);
  const challengeEnd = new Date(challenge.endAt);

  if (
    reqStart.getTime() < challengeStart.getTime() ||
    reqEnd.getTime() > challengeEnd.getTime()
  ) {
    throw new HttpError(
      422,
      "Requested booking window must be entirely within the accepted challenge window",
      "CONDITIONS_VIOLATION",
    );
  }

  // 4. Duration is 30–180 minutes
  const durationMinutes = Math.round(
    (reqEnd.getTime() - reqStart.getTime()) / MINUTE_MS,
  );
  if (durationMinutes < 30 || durationMinutes > 180) {
    throw new HttpError(
      422,
      `Booking duration must be between 30 and 180 minutes (got ${durationMinutes} minutes)`,
      "CONDITIONS_VIOLATION",
    );
  }

  // 5. Pitch is active and format exactly matches
  if (!pitch.isActive) {
    throw new HttpError(
      422,
      "Selected pitch is not active",
      "CONDITIONS_VIOLATION",
    );
  }

  if (pitch.size !== challenge.format) {
    throw new HttpError(
      422,
      `Pitch format (${pitch.size}) does not match agreed challenge format (${challenge.format})`,
      "CONDITIONS_VIOLATION",
    );
  }

  // 6. Pitch distance from accepted origin is within accepted radius
  const challengeOrigin: Coordinates = {
    lat: challenge.originLat,
    lng: challenge.originLng,
  };
  const pitchCoords: Coordinates = {
    lat: pitch.lat,
    lng: pitch.lng,
  };

  const distanceKm = haversineKm(challengeOrigin, pitchCoords);
  if (distanceKm > challenge.radiusKm + EPSILON_KM) {
    throw new HttpError(
      422,
      `Pitch distance (${distanceKm.toFixed(2)} km) exceeds accepted radius (${challenge.radiusKm} km)`,
      "CONDITIONS_VIOLATION",
    );
  }

  // 7. Requested time is produced by pitch inventory and not blocked
  let matchingSlot: AvailableSlot | undefined;

  if (input.availableSlots !== undefined) {
    matchingSlot = input.availableSlots.find(
      (s) =>
        new Date(s.startAt).getTime() === reqStart.getTime() &&
        new Date(s.endAt).getTime() === reqEnd.getTime(),
    );
  } else if (pitch.availabilityRules && pitch.availabilityRules.length > 0) {
    const slots = computeAvailableSlots({
      hourlyRate: {
        amountMinor: pitch.priceAmountMinor,
        currency: (pitch.currency ?? "DZD") as "DZD",
      },
      rules: pitch.availabilityRules,
      blocks: pitch.blocks ?? [],
      from: reqStart,
      to: reqEnd,
      durationMinutes,
      extraBlocks: input.extraBlocks ?? [],
    });

    matchingSlot = slots.find(
      (s) =>
        new Date(s.startAt).getTime() === reqStart.getTime() &&
        new Date(s.endAt).getTime() === reqEnd.getTime(),
    );
  }

  if (!matchingSlot) {
    throw new HttpError(
      409,
      "Requested time slot is not available in pitch inventory or is blocked",
      "INVENTORY_CONFLICT",
    );
  }

  return {
    compatible: true,
    priceAmountMinor: matchingSlot.price.amountMinor,
    currency: matchingSlot.price.currency,
    distanceKm,
    durationMinutes,
    slot: matchingSlot,
  };
}
