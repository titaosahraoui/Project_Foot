import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@footconnect/shared";
import { HttpError } from "./error-handler";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userId || !req.userRoles) {
      throw new HttpError(
        401,
        "Authentication required",
        "UNAUTHENTICATED",
      );
    }

    if (!req.userRoles.some((role) => allowedRoles.includes(role))) {
      throw new HttpError(403, "Insufficient role", "FORBIDDEN");
    }

    next();
  };
}
