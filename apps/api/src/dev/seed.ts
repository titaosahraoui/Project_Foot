import type { PrismaClient, UserRole } from "@prisma/client";

const ALGIERS = { lat: 36.7538, lng: 3.0588 } as const;

export const DEV_SEED_USERS = [
  {
    email: "player@footconnect.local",
    displayName: "Dev Player",
    roles: ["PLAYER"] satisfies UserRole[],
    skillLevel: "INTERMEDIATE" as const,
    position: "MID" as const,
    ...ALGIERS,
  },
  {
    email: "owner@footconnect.local",
    displayName: "Dev Pitch Owner",
    roles: ["PITCH_OWNER"] satisfies UserRole[],
    skillLevel: null,
    position: null,
    ...ALGIERS,
  },
  {
    email: "admin@footconnect.local",
    displayName: "Dev Admin",
    roles: ["ADMIN"] satisfies UserRole[],
    skillLevel: null,
    position: null,
    ...ALGIERS,
  },
] as const;

export const DEV_SEED_EMAILS = DEV_SEED_USERS.map((user) => user.email);

export function assertDevelopmentSeedAllowed(
  nodeEnv: string | undefined,
): void {
  if (nodeEnv !== "development") {
    throw new Error("Development seed requires NODE_ENV=development.");
  }
}

export async function seedDevelopmentUsers(
  prisma: PrismaClient,
  passwordHash: string,
) {
  return Promise.all(
    DEV_SEED_USERS.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        create: { ...user, passwordHash },
        update: { ...user, passwordHash },
      }),
    ),
  );
}
