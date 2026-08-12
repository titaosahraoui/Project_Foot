import { config } from "dotenv";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import {
  assertDevelopmentSeedAllowed,
  DEV_SEED_USERS,
  seedDevelopmentUsers,
} from "../src/dev/seed";

config({ path: resolve(__dirname, "../../../.env") });

async function main() {
  assertDevelopmentSeedAllowed(process.env.NODE_ENV);

  const passwordHash = await hashPassword("password123");
  await seedDevelopmentUsers(prisma, passwordHash);
  console.info(`Seeded ${DEV_SEED_USERS.length} local development users.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
