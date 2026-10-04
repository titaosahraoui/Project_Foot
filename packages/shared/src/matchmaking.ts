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
