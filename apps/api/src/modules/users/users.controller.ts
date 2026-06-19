import type { Request, Response } from "express";
import { updateProfileSchema } from "@footconnect/shared";
import * as service from "./users.service";

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await service.getProfile(req.userId!);
  res.json(user);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const input = updateProfileSchema.parse(req.body);
  const user = await service.updateProfile(req.userId!, input);
  res.json(user);
}
