import type { Request, Response } from "express";
import {
  createPitchSchema,
  createPitchSlotSchema,
  pitchQuerySchema,
  updatePitchSchema,
} from "@footconnect/shared";
import { z } from "zod";
import * as service from "./pitches.service";

export async function createPitchHandler(req: Request, res: Response): Promise<void> {
  const input = createPitchSchema.parse(req.body);
  const pitch = await service.createPitch(req.userId!, input);
  res.status(201).json(pitch);
}

export async function searchPitchesHandler(req: Request, res: Response): Promise<void> {
  const query = pitchQuerySchema.parse(req.query);
  const pitches = await service.searchPitches(query);
  res.json(pitches);
}

export async function getMyPitchesHandler(req: Request, res: Response): Promise<void> {
  const pitches = await service.getMyPitches(req.userId!);
  res.json(pitches);
}

export async function getPitchHandler(req: Request, res: Response): Promise<void> {
  const pitch = await service.getPitch(req.params.id!);
  res.json(pitch);
}

export async function updatePitchHandler(req: Request, res: Response): Promise<void> {
  const input = updatePitchSchema.parse(req.body);
  const pitch = await service.updatePitch(req.userId!, req.params.id!, input);
  res.json(pitch);
}

export async function getPitchSlotsHandler(req: Request, res: Response): Promise<void> {
  const slots = await service.getPitchSlots(req.params.id!);
  res.json(slots);
}

export async function createPitchSlotsHandler(req: Request, res: Response): Promise<void> {
  const slotsSchema = z.object({
    slots: z.array(createPitchSlotSchema),
  });
  const { slots } = slotsSchema.parse(req.body);
  const updatedSlots = await service.createPitchSlots(req.userId!, req.params.id!, slots);
  res.status(201).json(updatedSlots);
}
