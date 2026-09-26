import type {
  CreateTeamInput,
  FormatCode,
  Invitation,
  PlayerCard,
  SetTeamLineupInput,
  TeamDetail,
  TeamLineup,
  TeamCompetitiveSummary,
  TransferCaptainInput,
  UpdateTeamInput,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import { withTransaction } from "../../lib/transaction";
import * as ratingsService from "../ratings/ratings.service";
import { validateLineup } from "./lineup-rules";
import * as matchesAdapter from "./matches.adapter";
import * as repo from "./teams.repository";
import type {
  InvitationWithRefs,
  TeamLineupWithSlots,
  TeamWithMembers,
} from "./teams.repository";

function toPlayerCard(m: TeamWithMembers["members"][number]): PlayerCard {
  return {
    userId: m.user.id,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
    primaryPosition: m.user.position,
    teamRole: m.role,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    verifiedAppearances: 0,
    cardTheme: "FOOTCONNECT_BASE",
  };
}

function toTeamDetail(t: TeamWithMembers, rating: TeamCompetitiveSummary): TeamDetail {
  return {
    id: t.id,
    name: t.name,
    logoUrl: t.logoUrl,
    lat: t.lat,
    lng: t.lng,
    status: t.status,
    competitive: rating,
    memberCount: t.members.length,
    createdAt: t.createdAt.toISOString(),
    members: t.members.map(toPlayerCard),
    skillRating: rating.rating,
    wins: rating.wins,
    losses: rating.losses,
  };
}

function toTeamLineup(l: TeamLineupWithSlots): TeamLineup {
  return {
    id: l.id,
    teamId: l.teamId,
    format: l.format as FormatCode,
    formationCode: l.formationCode,
    updatedById: l.updatedById,
    updatedAt: l.updatedAt.toISOString(),
    slots: l.slots.map((s) => ({
      userId: s.userId,
      positionCode: s.positionCode,
      sortOrder: s.sortOrder,
    })),
  };
}

function toInvitation(i: InvitationWithRefs): Invitation {
  return {
    id: i.id,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    team: { id: i.team.id, name: i.team.name, logoUrl: i.team.logoUrl },
    inviter: { displayName: i.inviter.displayName },
  };
}

export async function assertActiveCaptain(
  teamId: string,
  userId: string,
  allowArchived = false,
): Promise<TeamWithMembers> {
  const team = await repo.findTeamById(teamId);
  if (!team) {
    throw new HttpError(404, "Team not found");
  }
  if (!allowArchived && team.status === "ARCHIVED") {
    throw new HttpError(409, "Team is archived and cannot be modified");
  }
  const membership = team.members.find((m) => m.userId === userId);
  if (!membership || membership.role !== "CAPTAIN") {
    throw new HttpError(403, "Only the team captain can do that");
  }
  return team;
}

export async function createTeam(userId: string, input: CreateTeamInput): Promise<TeamDetail> {
  return withTransaction(async (tx) => {
    const team = await repo.createTeamWithCaptain(userId, input, tx);
    const rating = await ratingsService.createInitialTeamRating(team.id, tx);
    return toTeamDetail(team, rating);
  });
}

export async function getTeam(teamId: string): Promise<TeamDetail> {
  const team = await repo.findTeamById(teamId);
  if (!team) throw new HttpError(404, "Team not found");
  const rating = await ratingsService.getTeamRating(teamId);
  return toTeamDetail(team, rating);
}

export async function getMyTeams(userId: string): Promise<TeamDetail[]> {
  const teams = await repo.findMyTeams(userId);
  return Promise.all(
    teams.map(async (t) => {
      const rating = await ratingsService.getTeamRating(t.id);
      return toTeamDetail(t, rating);
    }),
  );
}

export async function updateTeam(
  teamId: string,
  userId: string,
  input: UpdateTeamInput,
): Promise<TeamDetail> {
  await assertActiveCaptain(teamId, userId);
  const updated = await repo.updateTeam(teamId, input);
  const rating = await ratingsService.getTeamRating(teamId);
  return toTeamDetail(updated, rating);
}

export async function transferCaptain(
  teamId: string,
  userId: string,
  input: TransferCaptainInput,
): Promise<TeamDetail> {
  const team = await assertActiveCaptain(teamId, userId);
  if (input.newCaptainUserId === userId) {
    throw new HttpError(409, "Cannot transfer captaincy to yourself");
  }

  const targetMember = team.members.find((m) => m.userId === input.newCaptainUserId);
  if (!targetMember) {
    throw new HttpError(409, "Target user is not an active member of this team");
  }

  try {
    const updatedTeam = await withTransaction(async (tx) => {
      return repo.transferCaptain(teamId, userId, input.newCaptainUserId, tx);
    });
    const rating = await ratingsService.getTeamRating(teamId);
    return toTeamDetail(updatedTeam, rating);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message === "STALE_TRANSFER_DEMOTE_FAILED" ||
        err.message === "STALE_TRANSFER_PROMOTE_FAILED")
    ) {
      throw new HttpError(409, "Captain transfer failed due to concurrent modification");
    }
    throw err;
  }
}

export async function archiveTeam(teamId: string, userId: string): Promise<TeamDetail> {
  const team = await assertActiveCaptain(teamId, userId, true);
  if (team.status === "ARCHIVED") {
    const rating = await ratingsService.getTeamRating(teamId);
    return toTeamDetail(team, rating);
  }

  const hasMatches = await matchesAdapter.hasConfirmedFutureMatches(teamId);
  if (hasMatches) {
    throw new HttpError(400, "Cannot archive team with confirmed future matches");
  }

  const updated = await repo.updateTeamStatus(teamId, "ARCHIVED");
  const rating = await ratingsService.getTeamRating(teamId);
  return toTeamDetail(updated, rating);
}

export async function reactivateTeam(teamId: string, userId: string): Promise<TeamDetail> {
  const team = await assertActiveCaptain(teamId, userId, true);
  if (team.status === "ACTIVE") {
    const rating = await ratingsService.getTeamRating(teamId);
    return toTeamDetail(team, rating);
  }

  const updated = await repo.updateTeamStatus(teamId, "ACTIVE");
  const rating = await ratingsService.getTeamRating(teamId);
  return toTeamDetail(updated, rating);
}

export async function setLineup(
  teamId: string,
  userId: string,
  format: FormatCode,
  input: SetTeamLineupInput,
): Promise<TeamLineup> {
  const team = await assertActiveCaptain(teamId, userId);
  const activeMemberIds = new Set(team.members.map((m) => m.userId));
  validateLineup(format, input, activeMemberIds);

  const lineup = await repo.saveLineup(
    teamId,
    format,
    input.formationCode,
    userId,
    input.slots,
  );
  return toTeamLineup(lineup);
}

export async function getLineups(teamId: string): Promise<TeamLineup[]> {
  const team = await repo.findTeamById(teamId);
  if (!team) throw new HttpError(404, "Team not found");
  const lineups = await repo.findLineupsByTeamId(teamId);
  return lineups.map(toTeamLineup);
}

export async function invite(teamId: string, userId: string, email: string): Promise<void> {
  await assertActiveCaptain(teamId, userId);
  const invitee = await repo.findUserByEmail(email);
  if (!invitee) throw new HttpError(404, "No registered user with that email");
  const existing = await repo.findMembership(teamId, invitee.id);
  if (existing && existing.status === "ACTIVE") {
    throw new HttpError(409, "That user is already a team member");
  }
  await repo.upsertInvitation(teamId, invitee.id, userId);
}

export async function getMyInvitations(userId: string): Promise<Invitation[]> {
  return (await repo.findPendingInvitationsForUser(userId)).map(toInvitation);
}

export async function acceptInvitation(userId: string, invitationId: string): Promise<TeamDetail> {
  const inv = await repo.findInvitationById(invitationId);
  if (!inv || inv.inviteeId !== userId) throw new HttpError(404, "Invitation not found");
  if (inv.status !== "PENDING") throw new HttpError(409, "Invitation already handled");

  const team = await repo.findTeamById(inv.teamId);
  if (!team) throw new HttpError(404, "Team not found");
  if (team.status === "ARCHIVED") {
    throw new HttpError(409, "Cannot join an archived team");
  }

  await repo.acceptInvitation(inv.id, inv.teamId, userId);
  return getTeam(inv.teamId);
}

export async function declineInvitation(userId: string, invitationId: string): Promise<void> {
  const inv = await repo.findInvitationById(invitationId);
  if (!inv || inv.inviteeId !== userId) throw new HttpError(404, "Invitation not found");
  if (inv.status !== "PENDING") throw new HttpError(409, "Invitation already handled");
  await repo.declineInvitation(inv.id);
}

export async function removeMember(
  teamId: string,
  requesterId: string,
  targetUserId: string,
): Promise<void> {
  const team = await repo.findTeamById(teamId);
  if (!team) throw new HttpError(404, "Team not found");
  if (team.status === "ARCHIVED") {
    throw new HttpError(409, "Team is archived and cannot be modified");
  }

  const requester = team.members.find((m) => m.userId === requesterId);
  if (!requester) throw new HttpError(403, "Not a team member");

  const isSelf = requesterId === targetUserId;
  if (!isSelf && requester.role !== "CAPTAIN") {
    throw new HttpError(403, "Only the captain can remove members");
  }

  const target = team.members.find((m) => m.userId === targetUserId);
  if (!target) throw new HttpError(404, "Member not found");
  if (target.role === "CAPTAIN") {
    throw new HttpError(400, "The captain cannot leave or be removed in this version. Transfer captaincy first.");
  }

  await repo.setMembershipLeft(teamId, targetUserId);
}
