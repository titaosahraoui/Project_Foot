import { z } from "zod";

/** Mirrors the Prisma `UserRole` enum so clients don't depend on Prisma. */
export const userRoleSchema = z.enum(["PLAYER", "PITCH_OWNER", "ADMIN"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Mirrors the Prisma `SkillLevel` enum. */
export const skillLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"]);
export type SkillLevel = z.infer<typeof skillLevelSchema>;

export const playerPositionSchema = z.enum(["GK", "DEF", "MID", "FWD", "FLEX"]);
export type PlayerPosition = z.infer<typeof playerPositionSchema>;

export const displayNameSchema = z.string().trim().min(1).max(50);

export const avatarUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Avatar URL must use HTTPS",
  });

function hasPairedCoordinates(value: { lat?: number | null; lng?: number | null }) {
  const hasLat = value.lat !== undefined;
  const hasLng = value.lng !== undefined;
  if (hasLat !== hasLng) return false;
  return !hasLat || (value.lat === null) === (value.lng === null);
}

/** Editable profile fields. All optional; `null` clears a value. */
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    position: playerPositionSchema.nullable().optional(),
    skillLevel: skillLevelSchema.nullable().optional(),
    bio: z.string().max(500).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
  })
  .refine(hasPairedCoordinates, {
    message: "Latitude and longitude must be provided together",
    path: ["lat"],
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
