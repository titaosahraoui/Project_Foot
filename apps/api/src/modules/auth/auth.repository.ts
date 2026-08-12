import { prisma } from "../../lib/prisma";

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function createUserWithRefreshSession(input: {
  user: { email: string; passwordHash: string; displayName: string };
  session: { jti: string; expiresAt: Date };
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: input.user });
    await tx.refreshSession.create({
      data: { ...input.session, userId: user.id },
    });
    return user;
  });
}

export function createRefreshSession(input: {
  jti: string;
  userId: string;
  expiresAt: Date;
}) {
  return prisma.refreshSession.create({ data: input });
}

export function rotateRefreshSession(input: {
  currentJti: string;
  userId: string;
  replacementJti: string;
  replacementExpiresAt: Date;
}): Promise<boolean> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.refreshSession.updateMany({
      where: {
        jti: input.currentJti,
        userId: input.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        replacedByJti: input.replacementJti,
        lastUsedAt: now,
      },
    });
    if (consumed.count !== 1) return false;

    await tx.refreshSession.create({
      data: {
        jti: input.replacementJti,
        userId: input.userId,
        expiresAt: input.replacementExpiresAt,
      },
    });
    return true;
  });
}

export async function revokeRefreshSession(jti: string): Promise<void> {
  const now = new Date();
  await prisma.refreshSession.updateMany({
    where: { jti, revokedAt: null },
    data: { revokedAt: now, lastUsedAt: now },
  });
}
