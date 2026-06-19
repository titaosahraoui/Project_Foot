import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { HttpError } from "./error-handler";

/** Verifies the Bearer access token and attaches userId/roles to the request. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userRoles = payload.roles;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  next();
}
