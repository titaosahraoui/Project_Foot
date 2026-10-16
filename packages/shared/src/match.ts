import { z } from "zod";
import { matchFormatSchema } from "./domain";
import { offlinePaymentStatusSchema } from "./booking";
import { paginationQuerySchema } from "./common";
import { playerPositionSchema } from "./user";

export const matchStatusSchema = z.enum([
  "SCHEDULED",
  "AWAITING_RESULTS",
  "CONSENSUS_PENDING",
  "VERIFIED",
  "DISPUTED",
  "CANCELLED",
  "NO_SHOW",
]);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchParticipantRoleSchema = z.enum(["HOME", "AWAY"]);
export type MatchParticipantRole = z.infer<typeof matchParticipantRoleSchema>;

export const matchParticipantSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  teamId: z.string().uuid(),
  captainId: z.string().uuid(),
  role: matchParticipantRoleSchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type MatchParticipant = z.infer<typeof matchParticipantSchema>;

export const scheduledMatchSummarySchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  homeCaptainId: z.string().uuid(),
  awayCaptainId: z.string().uuid(),
  pitchOwnerId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  format: matchFormatSchema,
  status: matchStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  participants: z.array(matchParticipantSchema).optional(),
});
export type ScheduledMatchSummary = z.infer<typeof scheduledMatchSummarySchema>;

export const scheduleMatchFromBookingSchema = z.object({
  bookingId: z.string().uuid(),
  homeTeamId: z.string().uuid().optional(),
  awayTeamId: z.string().uuid().optional(),
  challengerTeamId: z.string().uuid().optional(),
  opponentTeamId: z.string().uuid().optional(),
  homeCaptainId: z.string().uuid().optional(),
  awayCaptainId: z.string().uuid().optional(),
  pitchOwnerId: z.string().uuid(),
  startAt: z.union([z.string().datetime({ offset: true }), z.date()]),
  endAt: z.union([z.string().datetime({ offset: true }), z.date()]),
  format: matchFormatSchema,
});
export type ScheduleMatchFromBookingInput = z.infer<
  typeof scheduleMatchFromBookingSchema
>;

// ---------------------------------------------------------------------------
// Match Summary & Detail (M09-T01)
// ---------------------------------------------------------------------------

export const matchTeamSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable().optional(),
  elo: z.number().int(),
});
export type MatchTeamSummary = z.infer<typeof matchTeamSummarySchema>;

export const matchPitchSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable().optional(),
  city: z.string(),
  surface: z.string(),
  format: z.string().optional(),
});
export type MatchPitchSummary = z.infer<typeof matchPitchSummarySchema>;

export const matchCaptainSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
});
export type MatchCaptainSummary = z.infer<typeof matchCaptainSummarySchema>;

export const matchViewerActionsSchema = z.object({
  canSubmitLineup: z.boolean().default(false),
  lineupDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  canCancel: z.boolean().default(false),
  canSubmitResult: z.boolean().default(false),
  canDispute: z.boolean().default(false),
  role: z.string().default("NONE"),
  allowedActions: z.array(z.string()).default([]),
});
export type MatchViewerActions = z.infer<typeof matchViewerActionsSchema>;

export const matchSummarySchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  homeCaptainId: z.string().uuid(),
  awayCaptainId: z.string().uuid(),
  pitchOwnerId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  format: matchFormatSchema,
  status: matchStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  homeTeam: matchTeamSummarySchema,
  awayTeam: matchTeamSummarySchema,
  pitch: matchPitchSummarySchema,
  homeCaptain: matchCaptainSummarySchema,
  awayCaptain: matchCaptainSummarySchema,
  algiersDateLabel: z.string(),
  algiersTimeRangeLabel: z.string(),
  algiersKickoffLabel: z.string(),
  priceAmountMinor: z.number().int().nonnegative(),
  currency: z.string().default("DZD"),
  paymentStatus: offlinePaymentStatusSchema,
});
export type MatchSummary = z.infer<typeof matchSummarySchema>;

export const matchDetailSchema = matchSummarySchema.extend({
  pitchOwner: matchCaptainSummarySchema,
  participants: z.array(matchParticipantSchema),
  viewerActions: matchViewerActionsSchema,
});
export type MatchDetail = z.infer<typeof matchDetailSchema>;

// Query & Pagination Schemas
export const listMatchesQuerySchema = paginationQuerySchema.extend({
  state: z.enum(["upcoming", "past"]).optional(),
  pitchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

export const paginatedMatchesResponseSchema = z.object({
  items: z.array(matchSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type PaginatedMatches = z.infer<typeof paginatedMatchesResponseSchema>;

// Timezone & Formatting Helpers
export function formatMatchAlgiersLabels(
  startAt: Date | string,
  endAt: Date | string,
): {
  algiersDateLabel: string;
  algiersTimeRangeLabel: string;
  algiersKickoffLabel: string;
} {
  const s = typeof startAt === "string" ? new Date(startAt) : startAt;
  const e = typeof endAt === "string" ? new Date(endAt) : endAt;

  const dateLabel = s.toLocaleDateString("en-US", {
    timeZone: "Africa/Algiers",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const startTime = s.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Algiers",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const endTime = e.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Algiers",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    algiersDateLabel: dateLabel,
    algiersTimeRangeLabel: `${startTime} – ${endTime}`,
    algiersKickoffLabel: startTime,
  };
}

// ---------------------------------------------------------------------------
// Match Lineups (M09-T02)
// ---------------------------------------------------------------------------

export const matchLineupSlotInputSchema = z.object({
  userId: z.string().uuid(),
  positionCode: z.string().min(1).max(10),
  sortOrder: z.number().int().min(0),
});
export type MatchLineupSlotInput = z.infer<typeof matchLineupSlotInputSchema>;

export const submitMatchLineupSchema = z
  .object({
    formationCode: z.string().min(1).max(20),
    slots: z.array(matchLineupSlotInputSchema).optional(),
    players: z.array(matchLineupSlotInputSchema).optional(),
    reason: z.string().max(280).optional(),
    replace: z.boolean().optional(),
  })
  .refine((data) => data.slots !== undefined || data.players !== undefined, {
    message: "Either slots or players must be provided",
  });
export type SubmitMatchLineupInput = z.infer<typeof submitMatchLineupSchema>;

export const replaceMatchLineupSchema = z
  .object({
    formationCode: z.string().min(1).max(20),
    slots: z.array(matchLineupSlotInputSchema).optional(),
    players: z.array(matchLineupSlotInputSchema).optional(),
    reason: z.string().max(280).optional(),
  })
  .refine((data) => data.slots !== undefined || data.players !== undefined, {
    message: "Either slots or players must be provided",
  });
export type ReplaceMatchLineupInput = z.infer<typeof replaceMatchLineupSchema>;

export const matchLineupPlayerSchema = z.object({
  id: z.string().uuid(),
  snapshotId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  primaryPosition: playerPositionSchema.nullable().optional(),
  positionCode: z.string(),
  sortOrder: z.number().int().min(0),
});
export type MatchLineupPlayer = z.infer<typeof matchLineupPlayerSchema>;

export const matchLineupSnapshotSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  teamId: z.string().uuid(),
  formationCode: z.string(),
  submittedById: z.string().uuid(),
  submittedAt: z.string().datetime({ offset: true }),
  version: z.number().int().positive().default(1),
  isCurrent: z.boolean().default(true),
  replacedAt: z.string().datetime({ offset: true }).nullable().optional(),
  replacedById: z.string().uuid().nullable().optional(),
  replacementReason: z.string().nullable().optional(),
  players: z.array(matchLineupPlayerSchema),
});
export type MatchLineupSnapshot = z.infer<typeof matchLineupSnapshotSchema>;
