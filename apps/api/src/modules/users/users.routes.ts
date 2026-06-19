import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { getMe, updateMe } from "./users.controller";

export const usersRouter: Router = Router();

usersRouter.get("/me", requireAuth, asyncHandler(getMe));
usersRouter.patch("/me", requireAuth, asyncHandler(updateMe));
