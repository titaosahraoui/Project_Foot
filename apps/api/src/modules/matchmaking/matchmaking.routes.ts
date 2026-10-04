import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import * as c from "./matchmaking.controller";

export const matchmakingRouter: Router = Router();

matchmakingRouter.use(requireAuth);

// Static routes before /:id routes
matchmakingRouter.post(
  "/availability",
  asyncHandler(c.createAvailabilityHandler),
);
matchmakingRouter.get(
  "/availability/mine",
  asyncHandler(c.getMyAvailabilityHandler),
);
matchmakingRouter.delete(
  "/availability/:id",
  asyncHandler(c.cancelAvailabilityHandler),
);
matchmakingRouter.get(
  "/availability/:id/recommendations",
  asyncHandler(c.getRecommendationsHandler),
);
