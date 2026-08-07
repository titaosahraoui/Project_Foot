import type { Request, Response } from "express";
import { createTeamSchema, inviteSchema, updateTeamSchema } from "@footconnect/shared";
import * as service from "./teams.service";

export async function createTeamHandler(req: Request, res: Response): Promise<void> {
  const input = createTeamSchema.parse(req.body);
  res.status(201).json(await service.createTeam(req.userId!, input));
}

export async function getMyTeamsHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.getMyTeams(req.userId!));
}

export async function getTeamHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.getTeam(req.params.id!));
}

export async function updateTeamHandler(req: Request, res: Response): Promise<void> {
  const input = updateTeamSchema.parse(req.body);
  res.json(await service.updateTeam(req.params.id!, req.userId!, input));
}

export async function inviteHandler(req: Request, res: Response): Promise<void> {
  const { email } = inviteSchema.parse(req.body);
  await service.invite(req.params.id!, req.userId!, email);
  res.status(201).json({ ok: true });
}

export async function myInvitationsHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.getMyInvitations(req.userId!));
}

export async function acceptInvitationHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.acceptInvitation(req.userId!, req.params.id!));
}

export async function declineInvitationHandler(req: Request, res: Response): Promise<void> {
  await service.declineInvitation(req.userId!, req.params.id!);
  res.status(204).send();
}

export async function removeMemberHandler(req: Request, res: Response): Promise<void> {
  await service.removeMember(req.params.id!, req.userId!, req.params.userId!);
  res.status(204).send();
}
