import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

// Singleton PrismaClient. Reused across modules; never instantiate elsewhere.
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
