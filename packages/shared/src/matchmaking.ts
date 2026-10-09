import { z } from "zod";
import {
  coordinatesSchema,
  paginationQuerySchema,
  type Coordinates,
  type PaginationQuery,
} from "./common";
import { matchFormatSchema, utcDateTimeSchema } from "./domain";

// ---------------------------------------------------------------------------
// Locked team-availability rules (see docs/superpowers/specs, "Locked defaults").
// ---------------------------------------------------------------------------

export const AVAILABILITY_MIN_DURATION_MINUTES = 60;
export const AVAILABILITY_MAX_DURATION_MINUTES = 240;
export const AVAILABILITY_MIN_LEAD_TIME_HOURS = 6;

export const AVAILABILITY_MIN_RADIUS_KM = 1;
export const AVAILABILITY_MAX_RADIUS_KM = 50;
export const AVAILABILITY_DEFAULT_RADIUS_KM = 10;

export const AVAILABILITY_MIN_ELO_TOLERANCE = 50;
export const AVAILABILITY_MAX_ELO_TOLERANCE = 500;
export const AVAILABILITY_DEFAULT_ELO_TOLERANCE = 150;

export const AVAILABILITY_MESSAGE_MAX_LENGTH = 280;

/** Decimal places kept when publishing an approximate area (0.01° ≈ 1.1 km). */
export const APPROXIMATE_AREA_DECIMALS = 2;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const availabilityStatusSchema = z.enum([
  "OPEN",
  "MATCHED",
  "CANCELLED",
  "EXPIRED",
]);
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;

// ---------------------------------------------------------------------------
// Approximate public area — never expose a team's raw origin coordinates.
// ---------------------------------------------------------------------------

const AREA_SCALE = 10 ** APPROXIMATE_AREA_DECIMALS;

function roundToArea(value: number): number {
  // Normalise -0 so serialised output is stable.
  return Math.round(value * AREA_SCALE) / AREA_SCALE + 0;
}

function hasAreaPrecision(value: number): boolean {
  return Math.abs(value * AREA_SCALE - Math.round(value * AREA_SCALE)) < 1e-6;
}

export const approximateAreaSchema = z.object({
  lat: z
    .number()
    .min(-90)
    .max(90)
    .refine(hasAreaPrecision, "Approximate area must be rounded"),
  lng: z
    .number()
    .min(-180)
    .max(180)
    .refine(hasAreaPrecision, "Approximate area must be rounded"),
});
export type ApproximateArea = z.infer<typeof approximateAreaSchema>;

export function toApproximateArea(origin: Coordinates): ApproximateArea {
  return { lat: roundToArea(origin.lat), lng: roundToArea(origin.lng) };
}

// ---------------------------------------------------------------------------
// Create command
// ---------------------------------------------------------------------------

/**
 * Builds the create-availability schema against an injectable clock so the
 * six-hour lead-time rule is deterministic in tests and server-side callers.
 */
export function buildCreateTeamAvailabilitySchema(
  now: () => Date = () => new Date(),
) {
  return z
    .object({
      teamId: z.string().uuid(),
      startAt: utcDateTimeSchema,
      endAt: utcDateTimeSchema,
      format: matchFormatSchema,
      origin: coordinatesSchema,
      radiusKm: z
        .number()
        .int()
        .min(AVAILABILITY_MIN_RADIUS_KM)
        .max(AVAILABILITY_MAX_RADIUS_KM)
        .default(AVAILABILITY_DEFAULT_RADIUS_KM),
      eloTolerance: z
        .number()
        .int()
        .min(AVAILABILITY_MIN_ELO_TOLERANCE)
        .max(AVAILABILITY_MAX_ELO_TOLERANCE)
        .default(AVAILABILITY_DEFAULT_ELO_TOLERANCE),
      message: z.string().trim().max(AVAILABILITY_MESSAGE_MAX_LENGTH).optional(),
    })
    .superRefine((data, ctx) => {
      const start = Date.parse(data.startAt);
      const end = Date.parse(data.endAt);
      const durationMinutes = (end - start) / MINUTE_MS;

      if (
        durationMinutes < AVAILABILITY_MIN_DURATION_MINUTES ||
        durationMinutes > AVAILABILITY_MAX_DURATION_MINUTES
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endAt"],
          message: `Availability must last between ${AVAILABILITY_MIN_DURATION_MINUTES} and ${AVAILABILITY_MAX_DURATION_MINUTES} minutes`,
        });
      }

      const earliestStart =
        now().getTime() + AVAILABILITY_MIN_LEAD_TIME_HOURS * HOUR_MS;
      if (start < earliestStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["startAt"],
          message: `Availability must start at least ${AVAILABILITY_MIN_LEAD_TIME_HOURS} hours from now`,
        });
      }
    });
}

export const createTeamAvailabilitySchema = buildCreateTeamAvailabilitySchema();
export type CreateTeamAvailabilityInput = z.input<
  typeof createTeamAvailabilitySchema
>;
export type CreateTeamAvailabilityPayload = z.output<
  typeof createTeamAvailabilitySchema
>;

// ---------------------------------------------------------------------------
// Update command
// ---------------------------------------------------------------------------

/**
 * Builds the update-availability schema against an injectable clock.
 * Allows updating search preferences, format, message, or time window.
 */
export function buildUpdateTeamAvailabilitySchema(
  _now: () => Date = () => new Date(),
) {
  return z
    .object({
      startAt: utcDateTimeSchema.optional(),
      endAt: utcDateTimeSchema.optional(),
      format: matchFormatSchema.optional(),
      origin: coordinatesSchema.optional(),
      radiusKm: z
        .number()
        .int()
        .min(AVAILABILITY_MIN_RADIUS_KM)
        .max(AVAILABILITY_MAX_RADIUS_KM)
        .optional(),
      eloTolerance: z
        .number()
        .int()
        .min(AVAILABILITY_MIN_ELO_TOLERANCE)
        .max(AVAILABILITY_MAX_ELO_TOLERANCE)
        .optional(),
      message: z.string().trim().max(AVAILABILITY_MESSAGE_MAX_LENGTH).nullable().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.startAt && data.endAt) {
        const start = Date.parse(data.startAt);
        const end = Date.parse(data.endAt);
        const durationMinutes = (end - start) / MINUTE_MS;

        if (
          durationMinutes < AVAILABILITY_MIN_DURATION_MINUTES ||
          durationMinutes > AVAILABILITY_MAX_DURATION_MINUTES
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endAt"],
            message: `Availability must last between ${AVAILABILITY_MIN_DURATION_MINUTES} and ${AVAILABILITY_MAX_DURATION_MINUTES} minutes`,
          });
        }
      }
    });
}

export const updateTeamAvailabilitySchema = buildUpdateTeamAvailabilitySchema();
export type UpdateTeamAvailabilityInput = z.input<
  typeof updateTeamAvailabilitySchema
>;
export type UpdateTeamAvailabilityPayload = z.output<
  typeof updateTeamAvailabilitySchema
>;

// ---------------------------------------------------------------------------
// Responses — strict so raw coordinates or private preferences cannot leak.
// ---------------------------------------------------------------------------

/** The availability as seen by its own team. */
export const teamAvailabilitySchema = z
  .object({
    id: z.string().uuid(),
    teamId: z.string().uuid(),
    createdById: z.string().uuid(),
    startAt: z.string(),
    endAt: z.string(),
    format: matchFormatSchema,
    approximateArea: approximateAreaSchema,
    radiusKm: z.number().int(),
    eloTolerance: z.number().int(),
    message: z.string().nullable(),
    status: availabilityStatusSchema,
    expiresAt: z.string(),
    matchedAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type TeamAvailability = z.infer<typeof teamAvailabilitySchema>;

/** The availability as seen by a potential opponent. */
export const publicTeamAvailabilitySchema = z
  .object({
    id: z.string().uuid(),
    teamId: z.string().uuid(),
    startAt: z.string(),
    endAt: z.string(),
    format: matchFormatSchema,
    approximateArea: approximateAreaSchema,
    message: z.string().nullable(),
  })
  .strict();
export type PublicTeamAvailability = z.infer<
  typeof publicTeamAvailabilitySchema
>;

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export const recommendedTeamSummarySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    logoUrl: z.string().nullable(),
    elo: z.number(),
  })
  .strict();
export type RecommendedTeamSummary = z.infer<
  typeof recommendedTeamSummarySchema
>;

export const overlappingWindowSchema = z
  .object({
    startAt: z.string(),
    endAt: z.string(),
    durationMinutes: z.number().int().positive(),
  })
  .strict();
export type OverlappingWindow = z.infer<typeof overlappingWindowSchema>;

export const recommendationExplanationSchema = z
  .object({
    eloDifference: z.number(),
    distanceKm: z.number(),
    format: matchFormatSchema,
    overlapMinutes: z.number().int().positive(),
    opponentReliability: z.string().nullable().default(null),
    eloScore: z.number().min(0).max(1),
    distanceScore: z.number().min(0).max(1),
  })
  .strict();
export type RecommendationExplanation = z.infer<
  typeof recommendationExplanationSchema
>;

export const opponentRecommendationSchema = z
  .object({
    availabilityId: z.string().uuid(),
    team: recommendedTeamSummarySchema,
    teamSummary: recommendedTeamSummarySchema,
    overlappingWindow: overlappingWindowSchema,
    format: matchFormatSchema,
    distanceKm: z.number(),
    eloDifference: z.number(),
    score: z.number().int().min(0).max(100),
    explanation: recommendationExplanationSchema,
    reliability: z.null(),
  })
  .strict();
export type OpponentRecommendation = z.infer<
  typeof opponentRecommendationSchema
>;

export const recommendationsQuerySchema = paginationQuerySchema;
export type RecommendationsQuery = PaginationQuery;

export const paginatedRecommendationsSchema = z
  .object({
    items: z.array(opponentRecommendationSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  })
  .strict();
export type PaginatedRecommendations = z.infer<
  typeof paginatedRecommendationsSchema
>;

// ---------------------------------------------------------------------------
// Match Challenge Domain & Lifecycle (Milestone 07)
// ---------------------------------------------------------------------------

export const challengeStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
]);
export type ChallengeStatus = z.infer<typeof challengeStatusSchema>;

export const CHALLENGE_RESPONSE_MAX_HOURS = 24;
export const CHALLENGE_RESPONSE_MIN_HOURS_BEFORE_START = 4;
export const CHALLENGE_BOOKING_MAX_HOURS = 24;
export const CHALLENGE_BOOKING_MIN_HOURS_BEFORE_START = 2;

/**
 * Challenge response is due at the earlier of 24h after creation or 4h before the window starts.
 */
export function calculateChallengeResponseDeadline(
  createdAt: Date,
  startAt: Date,
): Date {
  const byHours = new Date(
    createdAt.getTime() + CHALLENGE_RESPONSE_MAX_HOURS * HOUR_MS,
  );
  const byStart = new Date(
    startAt.getTime() - CHALLENGE_RESPONSE_MIN_HOURS_BEFORE_START * HOUR_MS,
  );
  return byHours.getTime() < byStart.getTime() ? byHours : byStart;
}

/**
 * Organizer booking is due at the earlier of 24h after acceptance or 2h before the window starts.
 */
export function calculateChallengeBookingDeadline(
  acceptedAt: Date,
  startAt: Date,
): Date {
  const byHours = new Date(
    acceptedAt.getTime() + CHALLENGE_BOOKING_MAX_HOURS * HOUR_MS,
  );
  const byStart = new Date(
    startAt.getTime() - CHALLENGE_BOOKING_MIN_HOURS_BEFORE_START * HOUR_MS,
  );
  return byHours.getTime() < byStart.getTime() ? byHours : byStart;
}

/** Snapshotted agreed conditions so later availability edits cannot alter an agreement. */
export const matchChallengeConditionsSchema = z
  .object({
    format: matchFormatSchema,
    startAt: utcDateTimeSchema,
    endAt: utcDateTimeSchema,
    approximateArea: approximateAreaSchema,
    radiusKm: z
      .number()
      .int()
      .min(AVAILABILITY_MIN_RADIUS_KM)
      .max(AVAILABILITY_MAX_RADIUS_KM),
  })
  .strict();
export type MatchChallengeConditions = z.infer<
  typeof matchChallengeConditionsSchema
>;

/** Input to create a match challenge. Enforces different teams and different availability rows. */
export const createMatchChallengeSchema = z
  .object({
    challengerTeamId: z.string().uuid().optional(),
    opponentTeamId: z.string().uuid().optional(),
    challengerAvailabilityId: z.string().uuid(),
    opponentAvailabilityId: z.string().uuid(),
    message: z.string().trim().max(AVAILABILITY_MESSAGE_MAX_LENGTH).optional(),
  })
  .strict()
  .refine(
    (data) =>
      !data.challengerTeamId ||
      !data.opponentTeamId ||
      data.challengerTeamId !== data.opponentTeamId,
    {
      message: "Challenger and opponent teams must be different",
      path: ["opponentTeamId"],
    },
  )
  .refine(
    (data) => data.challengerAvailabilityId !== data.opponentAvailabilityId,
    {
      message: "Challenger and opponent availabilities must be different",
      path: ["opponentAvailabilityId"],
    },
  );
export type CreateMatchChallengeInput = z.infer<
  typeof createMatchChallengeSchema
>;

/** Standard challenge response record representation (mirroring persistence). */
export const matchChallengeResponseSchema = z
  .object({
    id: z.string().uuid(),
    challengerTeamId: z.string().uuid(),
    opponentTeamId: z.string().uuid(),
    challengerAvailabilityId: z.string().uuid(),
    opponentAvailabilityId: z.string().uuid(),
    organizerUserId: z.string().uuid(),
    format: matchFormatSchema,
    startAt: utcDateTimeSchema,
    endAt: utcDateTimeSchema,
    approximateArea: approximateAreaSchema,
    radiusKm: z.number().int(),
    responseDeadline: utcDateTimeSchema,
    bookingDeadline: utcDateTimeSchema.nullable(),
    status: challengeStatusSchema,
    message: z.string().nullable(),
    respondedAt: utcDateTimeSchema.nullable(),
    cancelledAt: utcDateTimeSchema.nullable(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict();
export type MatchChallengeResponse = z.infer<
  typeof matchChallengeResponseSchema
>;

export const challengeActionSchema = z.enum(["ACCEPT", "DECLINE", "CANCEL"]);
export type ChallengeAction = z.infer<typeof challengeActionSchema>;

/** Summary view for inbox/outbox lists with team summaries and available actions. */
export const matchChallengeSummarySchema = z
  .object({
    id: z.string().uuid(),
    challengerTeamId: z.string().uuid(),
    opponentTeamId: z.string().uuid(),
    challengerTeam: recommendedTeamSummarySchema,
    opponentTeam: recommendedTeamSummarySchema,
    challengerAvailabilityId: z.string().uuid(),
    opponentAvailabilityId: z.string().uuid(),
    organizerUserId: z.string().uuid(),
    format: matchFormatSchema,
    startAt: utcDateTimeSchema,
    endAt: utcDateTimeSchema,
    approximateArea: approximateAreaSchema,
    radiusKm: z.number().int(),
    responseDeadline: utcDateTimeSchema,
    bookingDeadline: utcDateTimeSchema.nullable(),
    status: challengeStatusSchema,
    message: z.string().nullable(),
    respondedAt: utcDateTimeSchema.nullable(),
    cancelledAt: utcDateTimeSchema.nullable(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
    availableActions: z.array(challengeActionSchema).default([]),
  })
  .strict();
export type MatchChallengeSummary = z.infer<
  typeof matchChallengeSummarySchema
>;

/** Full detail view including snapshotted conditions and overlapping window. */
export const matchChallengeDetailSchema = matchChallengeSummarySchema.extend({
  conditions: matchChallengeConditionsSchema,
  overlappingWindow: overlappingWindowSchema,
});
export type MatchChallengeDetail = z.infer<
  typeof matchChallengeDetailSchema
>;

/** Action input for accepting or declining a challenge. */
export const respondToChallengeSchema = z
  .object({
    action: z.enum(["ACCEPT", "DECLINE"]),
    reason: z.string().trim().max(AVAILABILITY_MESSAGE_MAX_LENGTH).optional(),
  })
  .strict();
export type RespondToChallengeInput = z.infer<
  typeof respondToChallengeSchema
>;

export const matchChallengesQuerySchema = paginationQuerySchema.extend({
  teamId: z.string().uuid().optional(),
  status: challengeStatusSchema.optional(),
});
export type MatchChallengesQuery = z.infer<typeof matchChallengesQuerySchema>;

export const paginatedMatchChallengesSchema = z
  .object({
    items: z.array(matchChallengeSummarySchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  })
  .strict();
export type PaginatedMatchChallenges = z.infer<
  typeof paginatedMatchChallengesSchema
>;
