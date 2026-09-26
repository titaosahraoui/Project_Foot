import { z } from "zod";
import { playerPositionSchema } from "./user";

export const teamMemberRoleSchema = z.enum(["CAPTAIN", "MEMBER"]);
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>;

export const invitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const teamStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export type TeamStatus = z.infer<typeof teamStatusSchema>;

export const formatCodeSchema = z.enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"]);
export type FormatCode = z.infer<typeof formatCodeSchema>;

export const createTeamSchema = z.object({
  name: z.string().min(2).max(50),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  logoUrl: z.string().url().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const inviteSchema = z.object({
  email: z.string().email(),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const transferCaptainSchema = z.object({
  newCaptainUserId: z.string().uuid(),
});
export type TransferCaptainInput = z.infer<typeof transferCaptainSchema>;

/** FootConnect player card (projection of active User + TeamMembership). */
export const playerCardSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  primaryPosition: playerPositionSchema.nullable().optional(),
  teamRole: teamMemberRoleSchema,
  role: teamMemberRoleSchema.optional(),
  joinedAt: z.string(),
  verifiedAppearances: z.number(),
  cardTheme: z.literal("FOOTCONNECT_BASE"),
});
export type PlayerCard = z.infer<typeof playerCardSchema>;

/** Backwards-compatible alias for roster member. */
export const teamMemberSchema = playerCardSchema;
export type TeamMember = PlayerCard;

export const teamCompetitiveSummarySchema = z.object({
  rating: z.number(),
  matchesPlayed: z.number(),
  wins: z.number(),
  draws: z.number(),
  losses: z.number(),
});
export type TeamCompetitiveSummary = z.infer<typeof teamCompetitiveSummarySchema>;

export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  status: teamStatusSchema,
  competitive: teamCompetitiveSummarySchema,
  memberCount: z.number(),
  createdAt: z.string(),
  skillRating: z.number().optional(),
  wins: z.number().optional(),
  losses: z.number().optional(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamDetailSchema = teamSchema.extend({
  members: z.array(playerCardSchema),
});
export type TeamDetail = z.infer<typeof teamDetailSchema>;

export const teamLineupSlotSchema = z.object({
  userId: z.string().uuid(),
  positionCode: z.string(),
  sortOrder: z.number().int().min(0),
});
export type TeamLineupSlot = z.infer<typeof teamLineupSlotSchema>;

export const setTeamLineupSchema = z.object({
  formationCode: z.string(),
  slots: z.array(teamLineupSlotSchema),
});
export type SetTeamLineupInput = z.infer<typeof setTeamLineupSchema>;

export const teamLineupSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  format: formatCodeSchema,
  formationCode: z.string(),
  updatedById: z.string().uuid(),
  updatedAt: z.string(),
  slots: z.array(teamLineupSlotSchema),
});
export type TeamLineup = z.infer<typeof teamLineupSchema>;

/** A pending invitation as seen by the invitee. */
export const invitationSchema = z.object({
  id: z.string().uuid(),
  status: invitationStatusSchema,
  createdAt: z.string(),
  team: z.object({
    id: z.string().uuid(),
    name: z.string(),
    logoUrl: z.string().nullable(),
  }),
  inviter: z.object({
    displayName: z.string(),
  }),
});
export type Invitation = z.infer<typeof invitationSchema>;
