import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

export type TransactionContext = Prisma.TransactionClient;
export type RepositoryContext = PrismaClient | TransactionContext;

export function withTransaction<T>(
  work: (tx: TransactionContext) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => work(tx));
}
