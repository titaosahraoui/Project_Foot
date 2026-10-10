import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import * as c from "./matches.controller";

export const matchesRouter: Router = Router();

matchesRouter.get(
  "/by-booking/:bookingId",
  requireAuth,
  asyncHandler(c.getMatchByBookingHandler),
);

matchesRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(c.getMatchHandler),
);
