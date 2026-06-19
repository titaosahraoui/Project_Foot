import { z } from "zod";
import { skillLevelSchema, userRoleSchema } from "./user";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(50),
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
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(userRoleSchema),
  skillLevel: skillLevelSchema.nullable(),
  position: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  /** Present for mobile clients; web receives it as an httpOnly cookie instead. */
  refreshToken: z.string().optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
