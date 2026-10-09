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
matchmakingRouter.get(
  "/availability/:id",
  asyncHandler(c.getAvailabilityHandler),
);
matchmakingRouter.patch(
  "/availability/:id",
  asyncHandler(c.updateAvailabilityHandler),
);
matchmakingRouter.delete(
  "/availability/:id",
  asyncHandler(c.cancelAvailabilityHandler),
);
matchmakingRouter.get(
  "/availability/:id/recommendations",
  asyncHandler(c.getRecommendationsHandler),
);

// Match Challenges (Milestone 07)
// Static routes before /challenges/:id routes
matchmakingRouter.post(
  "/challenges",
  asyncHandler(c.createChallengeHandler),
);
matchmakingRouter.get(
  "/challenges/inbox",
  asyncHandler(c.getInboxChallengesHandler),
);
matchmakingRouter.get(
  "/challenges/outbox",
  asyncHandler(c.getOutboxChallengesHandler),
);
matchmakingRouter.get(
  "/challenges/:id",
  asyncHandler(c.getChallengeHandler),
);
matchmakingRouter.post(
  "/challenges/:id/accept",
  asyncHandler(c.acceptChallengeHandler),
);
matchmakingRouter.post(
  "/challenges/:id/decline",
  asyncHandler(c.declineChallengeHandler),
);
matchmakingRouter.post(
  "/challenges/:id/cancel",
  asyncHandler(c.cancelChallengeHandler),
);
