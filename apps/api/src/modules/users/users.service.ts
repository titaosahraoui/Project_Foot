import type { User } from "@prisma/client";
import {
  authUserSchema,
  type AuthUser,
  type UpdateProfileInput,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import * as repo from "./users.repository";

/** Map a Prisma User to the public, safe-to-expose shape. Reused by the auth module. */
export function toAuthUser(u: User): AuthUser {
  return authUserSchema.parse({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    roles: u.roles,
    skillLevel: u.skillLevel,
    position: u.position,
    lat: u.lat,
    lng: u.lng,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  });
}

export async function getProfile(userId: string): Promise<AuthUser> {
  const user = await repo.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  return toAuthUser(user);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
  const user = await repo.updateProfile(userId, input);
  return toAuthUser(user);
}
