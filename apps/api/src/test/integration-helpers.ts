import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import type {
  AuthResponse,
  RegisterInput,
  UserRole,
} from "@footconnect/shared";
import { prisma } from "../lib/prisma";

const defaultPassword = "password123";

export function uniqueEmail(prefix: string): string {
  return `${prefix}_${randomUUID()}@test.com`;
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function registerTestUser(
  app: Express,
  overrides: Partial<RegisterInput> = {},
): Promise<Pick<AuthResponse, "accessToken" | "user">> {
  const input: RegisterInput = {
    email: uniqueEmail("user"),
    password: defaultPassword,
    displayName: "Test User",
    ...overrides,
  };
  const response = await request(app).post("/api/v1/auth/register").send(input);

  if (response.status !== 201) {
    throw new Error(
      `Test user registration failed with status ${response.status}`,
    );
  }

  return response.body as Pick<AuthResponse, "accessToken" | "user">;
}

/**
 * Test-only fixture helper to create a user with specific elevated roles.
 *
 * Public registration intentionally does not allow clients to assign their own
 * roles (defaults strictly to `[PLAYER]`). In integration tests, users requiring
 * elevated roles (such as `PITCH_OWNER` or `ADMIN`) must be registered first through
 * the standard registration endpoint and then have their roles mutated directly
 * in the database fixture before re-authenticating to receive an access token that
 * reflects the elevated roles.
 */
export async function createTestUserWithRoles(
  app: Express,
  roles: UserRole[],
  overrides: Partial<RegisterInput> = {},
): Promise<Pick<AuthResponse, "accessToken" | "user">> {
  const input: RegisterInput = {
    email: uniqueEmail("user"),
    password: defaultPassword,
    displayName: "Test User",
    ...overrides,
  };
  const registered = await registerTestUser(app, input);

  await prisma.user.update({
    where: { id: registered.user.id },
    data: { roles },
  });

  const loginResponse = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: input.email, password: input.password });

  if (loginResponse.status !== 200) {
    throw new Error(
      `Test user login after role fixture mutation failed with status ${loginResponse.status}`,
    );
  }

  return loginResponse.body as Pick<AuthResponse, "accessToken" | "user">;
}

export async function disconnectTestDependencies(): Promise<void> {
  await prisma.$disconnect();
}
