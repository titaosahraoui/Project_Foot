import { z } from "zod";
import {
  avatarUrlSchema,
  displayNameSchema,
  playerPositionSchema,
  skillLevelSchema,
  userRoleSchema,
} from "./user";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Optional refresh token in the body (mobile clients). Web uses an httpOnly cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Public, safe-to-expose user shape (never includes passwordHash). */
export const authUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: displayNameSchema,
    roles: z.array(userRoleSchema),
    skillLevel: skillLevelSchema.nullable(),
    position: playerPositionSchema.nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    bio: z.string().max(500).nullable(),
    avatarUrl: avatarUrlSchema.nullable(),
    createdAt: z.string(),
  })
  .refine((value) => (value.lat === null) === (value.lng === null), {
    message: "Latitude and longitude must be provided together",
    path: ["lat"],
  });
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  /** Present for mobile clients; web receives it as an httpOnly cookie instead. */
  refreshToken: z.string().optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
