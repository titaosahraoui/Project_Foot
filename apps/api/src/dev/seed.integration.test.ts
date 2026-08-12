import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { disconnectTestDependencies } from "../test/integration-helpers";
import {
  assertDevelopmentSeedAllowed,
  DEV_SEED_EMAILS,
  seedDevelopmentUsers,
} from "./seed";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: DEV_SEED_EMAILS } } });
  await disconnectTestDependencies();
});

describe("development user seed (integration)", () => {
  it("only allows the seed runner in development", () => {
    expect(() => assertDevelopmentSeedAllowed("development")).not.toThrow();
    expect(() => assertDevelopmentSeedAllowed("production")).toThrow(
      "Development seed requires NODE_ENV=development.",
    );
    expect(() => assertDevelopmentSeedAllowed("test")).toThrow();
    expect(() => assertDevelopmentSeedAllowed(undefined)).toThrow();
  });

  it("is idempotent and creates usable player, owner, and admin accounts", async () => {
    await prisma.user.deleteMany({ where: { email: { in: DEV_SEED_EMAILS } } });
    const passwordHash = await hashPassword("password123");

    await seedDevelopmentUsers(prisma, passwordHash);
    await seedDevelopmentUsers(prisma, passwordHash);

    const users = await prisma.user.findMany({
      where: { email: { in: DEV_SEED_EMAILS } },
      orderBy: { email: "asc" },
    });

    expect(users).toHaveLength(3);
    expect(
      users.find((user) => user.email === "player@footconnect.local")?.roles,
    ).toEqual(["PLAYER"]);
    expect(
      users.find((user) => user.email === "owner@footconnect.local")?.roles,
    ).toEqual(["PITCH_OWNER"]);
    expect(
      users.find((user) => user.email === "admin@footconnect.local")?.roles,
    ).toEqual(["ADMIN"]);
    await expect(
      Promise.all(
        users.map((user) => verifyPassword(user.passwordHash, "password123")),
      ),
    ).resolves.toEqual([true, true, true]);
  });
});
