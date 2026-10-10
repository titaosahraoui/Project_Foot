import { z } from "zod";
import { paginationQuerySchema } from "./common";
import { currencyCodeSchema, utcDateTimeSchema } from "./domain";

// ---------------------------------------------------------------------------
// Booking Domain & Lifecycle Constants (Milestone 08)
// ---------------------------------------------------------------------------

export const BOOKING_MIN_DURATION_MINUTES = 30;
export const BOOKING_MAX_DURATION_MINUTES = 180;
export const BOOKING_DEFAULT_CURRENCY = "DZD" as const;
export const BOOKING_MESSAGE_MAX_LENGTH = 280;

export const BOOKING_OWNER_RESPONSE_MAX_HOURS = 24;
export const BOOKING_OWNER_RESPONSE_MIN_HOURS_BEFORE_START = 2;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const bookingStatusSchema = z.enum([
  "PENDING_OWNER_CONFIRMATION",
  "CONFIRMED",
  "DECLINED",
  "CANCELLED_BY_TEAM",
  "CANCELLED_BY_OWNER",
  "EXPIRED",
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const offlinePaymentStatusSchema = z.enum([
  "UNPAID",
  "PAID_AT_VENUE",
  "WAIVED",
]);
export type OfflinePaymentStatus = z.infer<typeof offlinePaymentStatusSchema>;

/**
 * Statuses that block a challenge or a pitch slot from other bookings.
 * Enforced by PostgreSQL partial unique index on challengeId.
 */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  "PENDING_OWNER_CONFIRMATION",
  "CONFIRMED",
] as const;

export function isBlockingBookingStatus(status: BookingStatus): boolean {
  return status === "PENDING_OWNER_CONFIRMATION" || status === "CONFIRMED";
}

// ---------------------------------------------------------------------------
// Helper: Owner response deadline calculation
// ---------------------------------------------------------------------------

/**
 * Owner response is due at the earlier of 24h after booking request or 2h before match start.
 */
export function calculateOwnerResponseDeadline(
  requestedAt: Date,
  startAt: Date,
): Date {
  const byHours = new Date(
    requestedAt.getTime() + BOOKING_OWNER_RESPONSE_MAX_HOURS * HOUR_MS,
  );
  const byStart = new Date(
    startAt.getTime() - BOOKING_OWNER_RESPONSE_MIN_HOURS_BEFORE_START * HOUR_MS,
  );
  return byHours.getTime() < byStart.getTime() ? byHours : byStart;
}

// ---------------------------------------------------------------------------
// Price Snapshot
// ---------------------------------------------------------------------------

export const bookingPriceSnapshotSchema = z.object({
  priceAmountMinor: z.number().int().nonnegative().safe(),
  currency: currencyCodeSchema.default("DZD"),
});
export type BookingPriceSnapshot = z.infer<typeof bookingPriceSnapshotSchema>;

// ---------------------------------------------------------------------------
// Create Booking Schema
// ---------------------------------------------------------------------------

export const createBookingSchema = z
  .object({
    challengeId: z.string().uuid(),
    pitchId: z.string().uuid(),
    startAt: utcDateTimeSchema,
    endAt: utcDateTimeSchema,
  })
  .strict()
  .refine(
    (data) => new Date(data.endAt).getTime() > new Date(data.startAt).getTime(),
    {
      message: "endAt must be strictly after startAt",
      path: ["endAt"],
    },
  )
  .refine(
    (data) => {
      const durationMinutes =
        (new Date(data.endAt).getTime() - new Date(data.startAt).getTime()) /
        MINUTE_MS;
      return (
        durationMinutes >= BOOKING_MIN_DURATION_MINUTES &&
        durationMinutes <= BOOKING_MAX_DURATION_MINUTES
      );
    },
    {
      message: `Booking duration must be between ${BOOKING_MIN_DURATION_MINUTES} and ${BOOKING_MAX_DURATION_MINUTES} minutes`,
      path: ["endAt"],
    },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// ---------------------------------------------------------------------------
// Decision & Cancel Schemas
// ---------------------------------------------------------------------------

export const bookingDecisionActionSchema = z.enum(["CONFIRM", "DECLINE"]);
export type BookingDecisionAction = z.infer<typeof bookingDecisionActionSchema>;

export const bookingDecisionSchema = z
  .object({
    decision: bookingDecisionActionSchema,
    reason: z
      .string()
      .trim()
      .max(BOOKING_MESSAGE_MAX_LENGTH, "Reason must not exceed 280 characters")
      .optional(),
  })
  .strict();
export type BookingDecisionInput = z.infer<typeof bookingDecisionSchema>;

export const confirmBookingSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(BOOKING_MESSAGE_MAX_LENGTH, "Reason must not exceed 280 characters")
      .optional(),
  })
  .strict();
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;

export const declineBookingSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(BOOKING_MESSAGE_MAX_LENGTH, "Reason must not exceed 280 characters")
      .optional(),
  })
  .strict();
export type DeclineBookingInput = z.infer<typeof declineBookingSchema>;

export const cancelBookingSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(BOOKING_MESSAGE_MAX_LENGTH, "Reason must not exceed 280 characters")
      .optional(),
    responsibleTeamId: z.string().uuid().optional(),
  })
  .strict();
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

// ---------------------------------------------------------------------------
// List Query Schema
// ---------------------------------------------------------------------------

export const listBookingsQuerySchema = paginationQuerySchema
  .extend({
    role: z.enum(["organizer", "captain", "owner"]).optional(),
    status: bookingStatusSchema.optional(),
    pitchId: z.string().uuid().optional(),
    challengeId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

// ---------------------------------------------------------------------------
// Core Booking DTO Schema
// ---------------------------------------------------------------------------

export const bookingSchema = z
  .object({
    id: z.string().uuid(),
    pitchId: z.string().uuid(),
    challengeId: z.string().uuid(),
    organizerUserId: z.string().uuid(),
    challengerTeamId: z.string().uuid(),
    opponentTeamId: z.string().uuid(),
    startAt: utcDateTimeSchema,
    endAt: utcDateTimeSchema,
    priceAmountMinor: z.number().int().nonnegative().safe(),
    currency: currencyCodeSchema,
    status: bookingStatusSchema,
    paymentStatus: offlinePaymentStatusSchema,
    ownerResponseDeadline: utcDateTimeSchema,
    confirmedAt: utcDateTimeSchema.nullable(),
    declinedAt: utcDateTimeSchema.nullable(),
    cancelledAt: utcDateTimeSchema.nullable(),
    expiresAt: utcDateTimeSchema.nullable(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict();
export type BookingDto = z.infer<typeof bookingSchema>;

// ---------------------------------------------------------------------------
// Detail Schema
// ---------------------------------------------------------------------------

export const bookingDetailSchema = bookingSchema
  .extend({
    pitch: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        address: z.string(),
        city: z.string(),
        surface: z.string(),
        size: z.string(),
        priceAmountMinor: z.number().int(),
        currency: z.string(),
        photos: z.array(z.string()).default([]),
      })
      .optional(),
    challengerTeam: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        logoUrl: z.string().nullable().optional(),
      })
      .optional(),
    opponentTeam: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        logoUrl: z.string().nullable().optional(),
      })
      .optional(),
    organizerUser: z
      .object({
        id: z.string().uuid(),
        displayName: z.string(),
        email: z.string().optional(),
      })
      .optional(),
    matchId: z.string().uuid().nullable().optional(),
    viewerPermissions: z
      .object({
        canConfirm: z.boolean(),
        canDecline: z.boolean(),
        canCancel: z.boolean(),
      })
      .optional(),
  })
  .strict();
export type BookingDetailDto = z.infer<typeof bookingDetailSchema>;

export const paginatedBookingsSchema = z
  .object({
    items: z.array(bookingDetailSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  })
  .strict();
export type PaginatedBookings = z.infer<typeof paginatedBookingsSchema>;
