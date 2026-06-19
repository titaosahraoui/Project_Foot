import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import type { AuthResponse, LoginInput, RegisterInput } from "@footconnect/shared";
import { env } from "../../config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type RefreshTokenPayload,
} from "../../lib/jwt";
import { hashPassword, verifyPassword } from "../../lib/password";
import { HttpError } from "../../middleware/error-handler";
import { toAuthUser } from "../users/users.service";
import * as repo from "./auth.repository";

const refreshTtlSeconds = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

/** Mint a fresh access + refresh token pair, recording the refresh jti in Redis. */
async function issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const jti = randomUUID();
  await repo.storeRefreshJti(jti, user.id, refreshTtlSeconds());
  return {
    accessToken: signAccessToken({ userId: user.id, roles: user.roles }),
    refreshToken: signRefreshToken(user.id, jti),
  };
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new HttpError(409, "Email already registered");

  const passwordHash = await hashPassword(input.password);
  const user = await repo.createUser({
    email: input.email,
    passwordHash,
    displayName: input.displayName,
  });

  const tokens = await issueTokens(user);
  return { user: toAuthUser(user), ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await repo.findByEmail(input.email);
  if (!user) throw new HttpError(401, "Invalid credentials");

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new HttpError(401, "Invalid credentials");

  const tokens = await issueTokens(user);
  return { user: toAuthUser(user), ...tokens };
}

export async function refresh(token: string): Promise<AuthResponse> {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }

  if (!(await repo.isRefreshJtiValid(payload.jti))) {
    throw new HttpError(401, "Refresh token has been revoked");
  }
  // Rotate: the old jti is single-use.
  await repo.revokeRefreshJti(payload.jti);

  const user = await repo.findById(payload.userId);
  if (!user) throw new HttpError(401, "User no longer exists");

  const tokens = await issueTokens(user);
  return { user: toAuthUser(user), ...tokens };
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    const payload = verifyRefreshToken(token);
    await repo.revokeRefreshJti(payload.jti);
  } catch {
    // Invalid/expired token on logout is a no-op.
  }
}
