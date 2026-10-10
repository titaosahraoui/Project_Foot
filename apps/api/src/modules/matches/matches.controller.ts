import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error-handler";
import * as service from "./matches.service";

export async function getMatchByBookingHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const bookingId = req.params.bookingId!;
  const match = await service.getMatchByBookingId(bookingId);
  if (!match) {
    throw new HttpError(404, "Match not found for booking", "NOT_FOUND");
  }
  res.json(match);
}

export async function getMatchHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id!;
  const match = await service.getMatchById(id);
  if (!match) {
    throw new HttpError(404, "Match not found", "NOT_FOUND");
  }
  res.json(match);
}
