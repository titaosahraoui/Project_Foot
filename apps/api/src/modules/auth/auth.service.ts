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
const refreshExpiresAt = () => new Date(Date.now() + refreshTtlSeconds() * 1000);

function createTokenPair(user: User, jti: string) {
  return {
    accessToken: signAccessToken({ userId: user.id, roles: user.roles }),
    refreshToken: signRefreshToken(user.id, jti),
  };
}

/** Mint a fresh access + refresh token pair with a durable refresh session. */
async function issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const jti = randomUUID();
  await repo.createRefreshSession({ jti, userId: user.id, expiresAt: refreshExpiresAt() });
  return createTokenPair(user, jti);
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

  const user = await repo.findById(payload.userId);
  if (!user) throw new HttpError(401, "User no longer exists");

  const replacementJti = randomUUID();
  const rotated = await repo.rotateRefreshSession({
    currentJti: payload.jti,
    userId: payload.userId,
    replacementJti,
    replacementExpiresAt: refreshExpiresAt(),
  });
  if (!rotated) throw new HttpError(401, "Refresh token is invalid or has been revoked");

  const tokens = createTokenPair(user, replacementJti);
  return { user: toAuthUser(user), ...tokens };
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    const payload = verifyRefreshToken(token);
    await repo.revokeRefreshSession(payload.jti);
  } catch {
    // Invalid/expired token on logout is a no-op.
  }
}
