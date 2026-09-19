import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { requireRole } from "../../middleware/require-role";
import * as c from "./pitches.controller";

export const pitchesRouter: Router = Router();

// Public routes
pitchesRouter.get("/", asyncHandler(c.searchPitchesHandler));
pitchesRouter.get(
  "/mine",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.getMyPitchesHandler),
);
pitchesRouter.get("/:id", asyncHandler(c.getPitchHandler));
pitchesRouter.get(
  "/:id/availability-rules",
  asyncHandler(c.getAvailabilityRulesHandler),
);
pitchesRouter.get(
  "/:id/available-slots",
  asyncHandler(c.getAvailableSlotsHandler),
);
pitchesRouter.get("/:id/slots", asyncHandler(c.getPitchSlotsHandler));

// Protected routes (pitch owners)
pitchesRouter.post(
  "/",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.createPitchHandler),
);
pitchesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.updatePitchHandler),
);
pitchesRouter.put(
  "/:id/availability-rules",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.setAvailabilityRulesHandler),
);
pitchesRouter.post(
  "/:id/blocks",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.createPitchBlockHandler),
);
pitchesRouter.delete(
  "/:id/blocks/:blockId",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.cancelPitchBlockHandler),
);
pitchesRouter.post(
  "/:id/slots",
  requireAuth,
  requireRole("PITCH_OWNER", "ADMIN"),
  asyncHandler(c.createPitchSlotsHandler),
);
