import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import type { AuthResponse, RegisterInput } from "@footconnect/shared";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

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
    throw new Error(`Test user registration failed with status ${response.status}`);
  }

  return response.body as Pick<AuthResponse, "accessToken" | "user">;
}

export async function disconnectTestDependencies(): Promise<void> {
  await prisma.$disconnect();
  redis.disconnect();
}
