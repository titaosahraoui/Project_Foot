import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import * as c from "./bookings.controller";

export const bookingsRouter: Router = Router();

bookingsRouter.post("/", requireAuth, asyncHandler(c.createBookingHandler));
bookingsRouter.get("/mine", requireAuth, asyncHandler(c.getMyBookingsHandler));
bookingsRouter.get("/owner", requireAuth, asyncHandler(c.getOwnerBookingsHandler));
bookingsRouter.get("/:id", requireAuth, asyncHandler(c.getBookingHandler));
bookingsRouter.get("/", requireAuth, asyncHandler(c.listBookingsHandler));
bookingsRouter.post("/:id/confirm", requireAuth, asyncHandler(c.confirmBookingHandler));
bookingsRouter.post("/:id/decline", requireAuth, asyncHandler(c.declineBookingHandler));
bookingsRouter.post("/:id/cancel", requireAuth, asyncHandler(c.cancelBookingHandler));
