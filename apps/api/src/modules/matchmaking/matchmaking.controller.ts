import type { Request, Response } from "express";
import {
  createTeamAvailabilitySchema,
  recommendationsQuerySchema,
  updateTeamAvailabilitySchema,
} from "@footconnect/shared";
import * as service from "./matchmaking.service";

export async function createAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createTeamAvailabilitySchema.parse(req.body);
  const result = await service.createAvailability(req.userId!, input);
  res.status(201).json(result);
}

export async function getMyAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await service.listMyAvailability(req.userId!);
  res.json(result);
}

export async function getAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await service.getAvailability(req.userId!, req.params.id!);
  res.json(result);
}

export async function updateAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = updateTeamAvailabilitySchema.parse(req.body);
  const result = await service.updateAvailability(
    req.userId!,
    req.params.id!,
    input,
  );
  res.json(result);
}

export async function cancelAvailabilityHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await service.cancelAvailability(req.userId!, req.params.id!);
  res.json(result);
}

export async function getRecommendationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = recommendationsQuerySchema.parse(req.query);
  const result = await service.getRecommendations(
    req.userId!,
    req.params.id!,
    query,
  );
  res.json(result);
}
