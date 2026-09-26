import type { Request, Response } from "express";
import {
  createTeamSchema,
  formatCodeSchema,
  inviteSchema,
  setTeamLineupSchema,
  transferCaptainSchema,
  updateTeamSchema,
} from "@footconnect/shared";
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

export async function transferCaptainHandler(req: Request, res: Response): Promise<void> {
  const input = transferCaptainSchema.parse(req.body);
  res.json(await service.transferCaptain(req.params.id!, req.userId!, input));
}

export async function archiveTeamHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.archiveTeam(req.params.id!, req.userId!));
}

export async function reactivateTeamHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.reactivateTeam(req.params.id!, req.userId!));
}

export async function getLineupsHandler(req: Request, res: Response): Promise<void> {
  res.json(await service.getLineups(req.params.id!));
}

export async function setLineupHandler(req: Request, res: Response): Promise<void> {
  const format = formatCodeSchema.parse(req.params.format);
  const input = setTeamLineupSchema.parse(req.body);
  res.json(await service.setLineup(req.params.id!, req.userId!, format, input));
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
