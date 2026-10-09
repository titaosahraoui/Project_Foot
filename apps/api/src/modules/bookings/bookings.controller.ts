import type { Request, Response } from "express";
import { listBookingsQuerySchema } from "@footconnect/shared";
import * as service from "./bookings.service";

export async function getBookingHandler(req: Request, res: Response): Promise<void> {
  const booking = await service.getBookingById(req.params.id!, req.userId);
  res.json(booking);
}

export async function listBookingsHandler(req: Request, res: Response): Promise<void> {
  const query = listBookingsQuerySchema.parse(req.query);
  const result = await service.listBookings(query, req.userId);
  res.json(result);
}

export async function getMyBookingsHandler(req: Request, res: Response): Promise<void> {
  const query = listBookingsQuerySchema.parse({
    ...req.query,
    role: "organizer",
  });
  const result = await service.listBookings(query, req.userId);
  res.json(result);
}

export async function getOwnerBookingsHandler(req: Request, res: Response): Promise<void> {
  const query = listBookingsQuerySchema.parse({
    ...req.query,
    role: "owner",
  });
  const result = await service.listBookings(query, req.userId);
  res.json(result);
}
