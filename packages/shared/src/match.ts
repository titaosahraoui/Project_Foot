import { z } from "zod";
import { matchFormatSchema } from "./domain";

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
