import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import * as c from "./pitches.controller";

export const pitchesRouter: Router = Router();

// Public routes
pitchesRouter.get("/", asyncHandler(c.searchPitchesHandler));
pitchesRouter.get("/mine", requireAuth, asyncHandler(c.getMyPitchesHandler));
pitchesRouter.get("/:id", asyncHandler(c.getPitchHandler));
pitchesRouter.get("/:id/availability-rules", asyncHandler(c.getAvailabilityRulesHandler));
pitchesRouter.get("/:id/slots", asyncHandler(c.getPitchSlotsHandler));

// Protected routes (pitch owners)
pitchesRouter.post("/", requireAuth, asyncHandler(c.createPitchHandler));
pitchesRouter.patch("/:id", requireAuth, asyncHandler(c.updatePitchHandler));
pitchesRouter.put(
  "/:id/availability-rules",
  requireAuth,
  asyncHandler(c.setAvailabilityRulesHandler),
);
pitchesRouter.post("/:id/slots", requireAuth, asyncHandler(c.createPitchSlotsHandler));
