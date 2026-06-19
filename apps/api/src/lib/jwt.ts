import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@footconnect/shared";
import { env } from "../config/env";

export interface AccessTokenPayload {
  userId: string;
  roles: UserRole[];
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    subject: payload.userId,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  };
  return jwt.sign({ roles: payload.roles }, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  return { userId: String(decoded.sub), roles: (decoded.roles ?? []) as UserRole[] };
}

export function signRefreshToken(userId: string, jti: string): string {
  const options: SignOptions = {
    subject: userId,
    jwtid: jti,
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as SignOptions["expiresIn"],
  };
  return jwt.sign({}, env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  return { userId: String(decoded.sub), jti: String(decoded.jti) };
}
