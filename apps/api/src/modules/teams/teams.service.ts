import type {
  CreateTeamInput,
  Invitation,
  TeamDetail,
  TeamMember,
  UpdateTeamInput,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import * as repo from "./teams.repository";
import type { InvitationWithRefs, TeamWithMembers } from "./teams.repository";

function toMember(m: TeamWithMembers["members"][number]): TeamMember {
  return {
    userId: m.user.id,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  };
}

function toTeamDetail(t: TeamWithMembers): TeamDetail {
  return {
    id: t.id,
    name: t.name,
    logoUrl: t.logoUrl,
    lat: t.lat,
    lng: t.lng,
    skillRating: t.skillRating,
    wins: t.wins,
    losses: t.losses,
    memberCount: t.members.length,
    createdAt: t.createdAt.toISOString(),
    members: t.members.map(toMember),
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

async function assertCaptain(teamId: string, userId: string): Promise<void> {
  const membership = await repo.findMembership(teamId, userId);
  if (!membership || membership.status !== "ACTIVE" || membership.role !== "CAPTAIN") {
    throw new HttpError(403, "Only the team captain can do that");
  }
}

export async function createTeam(userId: string, input: CreateTeamInput): Promise<TeamDetail> {
  return toTeamDetail(await repo.createTeamWithCaptain(userId, input));
}

export async function getTeam(teamId: string): Promise<TeamDetail> {
  const team = await repo.findTeamById(teamId);
  if (!team) throw new HttpError(404, "Team not found");
  return toTeamDetail(team);
}

export async function getMyTeams(userId: string): Promise<TeamDetail[]> {
  return (await repo.findMyTeams(userId)).map(toTeamDetail);
}

export async function updateTeam(
  teamId: string,
  userId: string,
  input: UpdateTeamInput,
): Promise<TeamDetail> {
  await assertCaptain(teamId, userId);
  return toTeamDetail(await repo.updateTeam(teamId, input));
}

export async function invite(teamId: string, userId: string, email: string): Promise<void> {
  await assertCaptain(teamId, userId);
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
  const requester = await repo.findMembership(teamId, requesterId);
  if (!requester || requester.status !== "ACTIVE") throw new HttpError(403, "Not a team member");

  const isSelf = requesterId === targetUserId;
  if (!isSelf && requester.role !== "CAPTAIN") {
    throw new HttpError(403, "Only the captain can remove members");
  }

  const target = await repo.findMembership(teamId, targetUserId);
  if (!target || target.status !== "ACTIVE") throw new HttpError(404, "Member not found");
  if (target.role === "CAPTAIN") {
    throw new HttpError(400, "The captain cannot leave or be removed in this version");
  }

  await repo.setMembershipLeft(teamId, targetUserId);
}
