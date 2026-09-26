import { Prisma } from "@prisma/client";
import type { UpdateTeamInput } from "@footconnect/shared";
import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";

// Active roster, each member joined with their public user fields (including position).
const teamInclude = {
  members: {
    where: { status: "ACTIVE" as const },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          position: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" as const },
  },
} satisfies Prisma.TeamInclude;

export type TeamWithMembers = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

const lineupInclude = {
  slots: {
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.TeamLineupInclude;

export type TeamLineupWithSlots = Prisma.TeamLineupGetPayload<{ include: typeof lineupInclude }>;

export function createTeamWithCaptain(
  userId: string,
  data: { name: string; lat?: number; lng?: number },
  db: RepositoryContext = prisma,
): Promise<TeamWithMembers> {
  return db.team.create({
    data: {
      name: data.name,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      status: "ACTIVE",
      members: { create: { userId, role: "CAPTAIN", status: "ACTIVE" } },
    },
    include: teamInclude,
  });
}

export function findTeamById(id: string, db: RepositoryContext = prisma): Promise<TeamWithMembers | null> {
  return db.team.findUnique({ where: { id }, include: teamInclude });
}

export function findMyTeams(userId: string, db: RepositoryContext = prisma): Promise<TeamWithMembers[]> {
  return db.team.findMany({
    where: { members: { some: { userId, status: "ACTIVE" } } },
    include: teamInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function updateTeam(
  id: string,
  data: UpdateTeamInput,
  db: RepositoryContext = prisma,
): Promise<TeamWithMembers> {
  return db.team.update({
    where: { id },
    data: data as Prisma.TeamUpdateInput,
    include: teamInclude,
  });
}

export function updateTeamStatus(
  id: string,
  status: "ACTIVE" | "ARCHIVED",
  db: RepositoryContext = prisma,
): Promise<TeamWithMembers> {
  return db.team.update({
    where: { id },
    data: { status },
    include: teamInclude,
  });
}

export function findMembership(teamId: string, userId: string, db: RepositoryContext = prisma) {
  return db.teamMembership.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

export function findActiveCaptainMembership(teamId: string, db: RepositoryContext = prisma) {
  return db.teamMembership.findFirst({
    where: { teamId, role: "CAPTAIN", status: "ACTIVE" },
  });
}

export async function transferCaptain(
  teamId: string,
  currentCaptainUserId: string,
  newCaptainUserId: string,
  db: RepositoryContext = prisma,
): Promise<TeamWithMembers> {
  // Execute updates inside the provided context or default prisma transaction
  const demoted = await db.teamMembership.updateMany({
    where: { teamId, userId: currentCaptainUserId, role: "CAPTAIN", status: "ACTIVE" },
    data: { role: "MEMBER" },
  });
  if (demoted.count !== 1) {
    throw new Error("STALE_TRANSFER_DEMOTE_FAILED");
  }

  const promoted = await db.teamMembership.updateMany({
    where: { teamId, userId: newCaptainUserId, role: "MEMBER", status: "ACTIVE" },
    data: { role: "CAPTAIN" },
  });
  if (promoted.count !== 1) {
    throw new Error("STALE_TRANSFER_PROMOTE_FAILED");
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: teamInclude,
  });
  if (!team) throw new Error("Team not found");
  return team;
}

export function findUserByEmail(email: string, db: RepositoryContext = prisma) {
  return db.user.findUnique({ where: { email } });
}

export function upsertInvitation(
  teamId: string,
  inviteeId: string,
  inviterId: string,
  db: RepositoryContext = prisma,
) {
  return db.invitation.upsert({
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

export function findPendingInvitationsForUser(
  userId: string,
  db: RepositoryContext = prisma,
): Promise<InvitationWithRefs[]> {
  return db.invitation.findMany({
    where: { inviteeId: userId, status: "PENDING" },
    include: invitationInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function findInvitationById(id: string, db: RepositoryContext = prisma) {
  return db.invitation.findUnique({ where: { id } });
}

export function acceptInvitation(
  invitationId: string,
  teamId: string,
  userId: string,
  db: RepositoryContext = prisma,
) {
  return prisma.$transaction([
    db.invitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
    db.teamMembership.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId, role: "MEMBER", status: "ACTIVE" },
      update: { status: "ACTIVE", role: "MEMBER" },
    }),
  ]);
}

export function declineInvitation(id: string, db: RepositoryContext = prisma) {
  return db.invitation.update({
    where: { id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
}

export function setMembershipLeft(teamId: string, userId: string, db: RepositoryContext = prisma) {
  return db.teamMembership.update({
    where: { teamId_userId: { teamId, userId } },
    data: { status: "LEFT" },
  });
}

export function findLineupsByTeamId(
  teamId: string,
  db: RepositoryContext = prisma,
): Promise<TeamLineupWithSlots[]> {
  return db.teamLineup.findMany({
    where: { teamId },
    include: lineupInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export function findLineupByTeamAndFormat(
  teamId: string,
  format: string,
  db: RepositoryContext = prisma,
): Promise<TeamLineupWithSlots | null> {
  return db.teamLineup.findUnique({
    where: { teamId_format: { teamId, format } },
    include: lineupInclude,
  });
}

export async function saveLineup(
  teamId: string,
  format: string,
  formationCode: string,
  updatedById: string,
  slots: { userId: string; positionCode: string; sortOrder: number }[],
  db: RepositoryContext = prisma,
): Promise<TeamLineupWithSlots> {
  const lineup = await db.teamLineup.upsert({
    where: { teamId_format: { teamId, format } },
    create: {
      teamId,
      format,
      formationCode,
      updatedById,
    },
    update: {
      formationCode,
      updatedById,
    },
  });

  // Delete existing slots and create new ones atomically
  await db.teamLineupSlot.deleteMany({
    where: { lineupId: lineup.id },
  });

  await db.teamLineupSlot.createMany({
    data: slots.map((s) => ({
      lineupId: lineup.id,
      userId: s.userId,
      positionCode: s.positionCode,
      sortOrder: s.sortOrder,
    })),
  });

  const updated = await db.teamLineup.findUnique({
    where: { id: lineup.id },
    include: lineupInclude,
  });

  if (!updated) {
    throw new Error("Failed to load updated lineup");
  }

  return updated;
}
