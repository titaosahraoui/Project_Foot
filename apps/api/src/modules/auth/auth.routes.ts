import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
} from "./auth.controller";

export const authRouter: Router = Router();

authRouter.post("/register", asyncHandler(registerHandler));
authRouter.post("/login", asyncHandler(loginHandler));
authRouter.post("/refresh", asyncHandler(refreshHandler));
authRouter.post("/logout", asyncHandler(logoutHandler));
