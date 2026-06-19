import "express";
import type { UserRole } from "@footconnect/shared";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after verifying the access token. */
      userId?: string;
      userRoles?: UserRole[];
    }
  }
}
