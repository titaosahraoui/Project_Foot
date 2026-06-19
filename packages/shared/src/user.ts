import { z } from "zod";

/** Mirrors the Prisma `UserRole` enum so clients don't depend on Prisma. */
export const userRoleSchema = z.enum(["PLAYER", "PITCH_OWNER", "ADMIN"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Mirrors the Prisma `SkillLevel` enum. */
export const skillLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"]);
export type SkillLevel = z.infer<typeof skillLevelSchema>;

/** Editable profile fields. All optional; `null` clears a value. */
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  position: z.string().max(30).nullable().optional(),
  skillLevel: skillLevelSchema.nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
