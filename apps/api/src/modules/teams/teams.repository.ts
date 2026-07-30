import { Prisma } from "@prisma/client";
import type { UpdateTeamInput } from "@footconnect/shared";
import { prisma } from "../../lib/prisma";

// Active roster, each member joined with their public user fields.
const teamInclude = {
  members: {
    where: { status: "ACTIVE" as const },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" as const },
  },
} satisfies Prisma.TeamInclude;

export type TeamWithMembers = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

export function createTeamWithCaptain(
  userId: string,
  data: { name: string; lat?: number; lng?: number },
): Promise<TeamWithMembers> {
  return prisma.team.create({
    data: {
      name: data.name,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      members: { create: { userId, role: "CAPTAIN", status: "ACTIVE" } },
    },
    include: teamInclude,
  });
}

export function findTeamById(id: string): Promise<TeamWithMembers | null> {
  return prisma.team.findUnique({ where: { id }, include: teamInclude });
}

export function findMyTeams(userId: string): Promise<TeamWithMembers[]> {
  return prisma.team.findMany({
    where: { members: { some: { userId, status: "ACTIVE" } } },
    include: teamInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function updateTeam(id: string, data: UpdateTeamInput): Promise<TeamWithMembers> {
  return prisma.team.update({
    where: { id },
    data: data as Prisma.TeamUpdateInput,
    include: teamInclude,
  });
}

export function findMembership(teamId: string, userId: string) {
  return prisma.teamMembership.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function upsertInvitation(teamId: string, inviteeId: string, inviterId: string) {
  return prisma.invitation.upsert({
    where: { teamId_inviteeId: { teamId, inviteeId } },
    create: { teamId, inviteeId, inviterId, status: "PENDING" },
    update: { status: "PENDING", inviterId, respondedAt: null },
  });
}

const invitationInclude = {
  team: { select: { id: true, name: true, logoUrl: true } },
  inviter: { select: { displayName: true } },
} satisfies Prisma.InvitationInclude;

export type InvitationWithRefs = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

export function findPendingInvitationsForUser(userId: string): Promise<InvitationWithRefs[]> {
  return prisma.invitation.findMany({
    where: { inviteeId: userId, status: "PENDING" },
    include: invitationInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function findInvitationById(id: string) {
  return prisma.invitation.findUnique({ where: { id } });
}

export function acceptInvitation(invitationId: string, teamId: string, userId: string) {
  return prisma.$transaction([
    prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
    prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId, role: "MEMBER", status: "ACTIVE" },
      update: { status: "ACTIVE", role: "MEMBER" },
    }),
  ]);
}

export function declineInvitation(id: string) {
  return prisma.invitation.update({
    where: { id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
}

export function setMembershipLeft(teamId: string, userId: string) {
  return prisma.teamMembership.update({
    where: { teamId_userId: { teamId, userId } },
    data: { status: "LEFT" },
  });
}
