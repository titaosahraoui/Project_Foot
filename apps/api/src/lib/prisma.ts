import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient. Reused across modules; never instantiate elsewhere.
export const prisma = new PrismaClient();

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
