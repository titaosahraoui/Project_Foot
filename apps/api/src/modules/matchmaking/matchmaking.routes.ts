import { Router } from "express";

// Mounted at /api/v1/matchmaking. Availability endpoints are registered in
// M06-T04 and challenge endpoints in M07; until then requests fall through to
// the standard 404 handler.
export const matchmakingRouter: Router = Router();
