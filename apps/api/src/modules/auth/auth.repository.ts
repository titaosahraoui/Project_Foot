import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";

const jtiKey = (jti: string) => `refresh:${jti}`;

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(input: { email: string; passwordHash: string; displayName: string }) {
  return prisma.user.create({ data: input });
}

/** Store a valid refresh-token id (jti) with the same TTL as the token. */
export async function storeRefreshJti(jti: string, userId: string, ttlSeconds: number): Promise<void> {
  await redis.set(jtiKey(jti), userId, "EX", ttlSeconds);
}

export async function isRefreshJtiValid(jti: string): Promise<boolean> {
  const value = await redis.get(jtiKey(jti));
  return value !== null;
}

export async function revokeRefreshJti(jti: string): Promise<void> {
  await redis.del(jtiKey(jti));
}
