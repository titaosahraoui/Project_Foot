import type { Request, Response } from "express";
import { listMatchesQuerySchema } from "@footconnect/shared";
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
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const match = await service.getMatchDetail(userId, userRoles, id);
  res.json(match);
}

export async function getMyMatchesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.userId!;
  const query = listMatchesQuerySchema.parse(req.query);
  const result = await service.getMyMatches(userId, query);
  res.json(result);
}

export async function getOwnerMatchesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const query = listMatchesQuerySchema.parse(req.query);
  const result = await service.getOwnerMatches(userId, userRoles, query);
  res.json(result);
}
