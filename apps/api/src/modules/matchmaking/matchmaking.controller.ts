import type { Request, Response } from "express";
import {
  createMatchChallengeSchema,
  createTeamAvailabilitySchema,
  matchChallengesQuerySchema,
  recommendationsQuerySchema,
  updateTeamAvailabilitySchema,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
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

// ---------------------------------------------------------------------------
// Match Challenge Handlers (Milestone 07)
// ---------------------------------------------------------------------------

export async function createChallengeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const idempotencyKey =
    req.header("idempotency-key") || req.header("Idempotency-Key");
  if (
    !idempotencyKey ||
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim()
  ) {
    throw new HttpError(
      400,
      "Idempotency-Key header is required",
      "VALIDATION_ERROR",
    );
  }

  const input = createMatchChallengeSchema.parse(req.body);
  const challenge = await service.createChallenge(
    req.userId!,
    input,
    new Date(),
    undefined,
    idempotencyKey.trim(),
  );
  const detail = await service.getChallengeDetail(req.userId!, challenge.id);
  res.status(201).json(detail);
}

export async function getInboxChallengesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = matchChallengesQuerySchema.parse(req.query);
  const result = await service.listInboxChallenges(req.userId!, query);
  res.json(result);
}

export async function getOutboxChallengesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const query = matchChallengesQuerySchema.parse(req.query);
  const result = await service.listOutboxChallenges(req.userId!, query);
  res.json(result);
}

export async function getChallengeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await service.getChallengeDetail(req.userId!, req.params.id!);
  res.json(result);
}

export async function acceptChallengeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await service.acceptChallenge(req.userId!, req.params.id!);
  const detail = await service.getChallengeDetail(req.userId!, req.params.id!);
  res.json(detail);
}

export async function declineChallengeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await service.declineChallenge(req.userId!, req.params.id!);
  const detail = await service.getChallengeDetail(req.userId!, req.params.id!);
  res.json(detail);
}

export async function cancelChallengeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await service.cancelChallenge(req.userId!, req.params.id!);
  const detail = await service.getChallengeDetail(req.userId!, req.params.id!);
  res.json(detail);
}
