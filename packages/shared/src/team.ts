import { z } from "zod";

export const teamMemberRoleSchema = z.enum(["CAPTAIN", "MEMBER"]);
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>;

export const invitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

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

/** A roster entry (member + their public user info). */
export const teamMemberSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: teamMemberRoleSchema,
  joinedAt: z.string(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  skillRating: z.number(),
  wins: z.number(),
  losses: z.number(),
  memberCount: z.number(),
  createdAt: z.string(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamDetailSchema = teamSchema.extend({
  members: z.array(teamMemberSchema),
});
export type TeamDetail = z.infer<typeof teamDetailSchema>;

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
