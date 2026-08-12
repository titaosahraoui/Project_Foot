import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  disconnectTestDependencies,
  uniqueEmail,
} from "../../test/integration-helpers";

const app = createApp();
const email = uniqueEmail("auth");
const password = "password123";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await disconnectTestDependencies();
});

describe("auth flow (integration)", () => {
  let userId = "";
  let accessToken = "";
  let refreshToken = "";

  it("registers a new user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, displayName: "Test Player" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    userId = res.body.user.id;

    const payload = verifyRefreshToken(res.body.refreshToken);
    await expect(
      prisma.refreshSession.findUnique({ where: { jti: payload.jti } }),
    ).resolves.toMatchObject({
      userId: res.body.user.id,
      revokedAt: null,
      replacedByJti: null,
    });
  });

  it("rejects duplicate registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, displayName: "Test Player" });
    expect(res.status).toBe(409);
  });

  it("returns a conflict when the same new email is registered concurrently", async () => {
    const concurrentEmail = uniqueEmail("auth-concurrent");

    try {
      const responses = await Promise.all(
        ["Concurrent One", "Concurrent Two"].map((displayName) =>
          request(app).post("/api/v1/auth/register").send({
            email: concurrentEmail,
            password,
            displayName,
          }),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      await expect(
        prisma.user.count({ where: { email: concurrentEmail } }),
      ).resolves.toBe(1);
    } finally {
      await prisma.user.deleteMany({ where: { email: concurrentEmail } });
    }
  });

  it("rolls back the user when initial refresh-session creation fails", async () => {
    const rollbackEmail = uniqueEmail("auth-rollback");
    const escapedEmail = rollbackEmail.replaceAll("'", "''");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION fail_initial_session_for_test()
      RETURNS trigger AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "users"
          WHERE "id" = NEW."userId" AND "email" = '${escapedEmail}'
        ) THEN
          RAISE EXCEPTION 'forced refresh-session failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER fail_initial_session_for_test
      BEFORE INSERT ON "refresh_sessions"
      FOR EACH ROW EXECUTE FUNCTION fail_initial_session_for_test();
    `);

    try {
      const response = await request(app).post("/api/v1/auth/register").send({
        email: rollbackEmail,
        password,
        displayName: "Rollback Player",
      });

      expect(response.status).toBe(500);
      await expect(
        prisma.user.findUnique({ where: { email: rollbackEmail } }),
      ).resolves.toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS fail_initial_session_for_test ON "refresh_sessions"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS fail_initial_session_for_test()`,
      );
      await prisma.user.deleteMany({ where: { email: rollbackEmail } });
    }
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(res.status).toBe(200);
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("returns the profile with a valid token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("rejects the profile without a token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
  });

  it("rotates the refresh token and revokes the old one", async () => {
    const oldPayload = verifyRefreshToken(refreshToken);
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTruthy();

    const newPayload = verifyRefreshToken(res.body.refreshToken);
    await expect(
      prisma.refreshSession.findUnique({ where: { jti: oldPayload.jti } }),
    ).resolves.toMatchObject({
      revokedAt: expect.any(Date),
      replacedByJti: newPayload.jti,
      lastUsedAt: expect.any(Date),
    });
    await expect(
      prisma.refreshSession.findUnique({ where: { jti: newPayload.jti } }),
    ).resolves.toMatchObject({
      revokedAt: null,
      replacedByJti: null,
    });

    // The old refresh token is now single-use / revoked.
    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(reuse.status).toBe(401);

    refreshToken = res.body.refreshToken;
  });

  it("allows exactly one concurrent refresh rotation", async () => {
    const responses = await Promise.all([
      request(app).post("/api/v1/auth/refresh").send({ refreshToken }),
      request(app).post("/api/v1/auth/refresh").send({ refreshToken }),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([200, 401]);
    refreshToken = responses.find((response) => response.status === 200)!.body
      .refreshToken;
  });

  it("rejects a refresh token with an unknown session", async () => {
    const token = signRefreshToken(userId, randomUUID());

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: token });

    expect(response.status).toBe(401);
  });

  it("rejects a refresh token whose database session is expired", async () => {
    const jti = randomUUID();
    await prisma.refreshSession.create({
      data: { jti, userId, expiresAt: new Date("2000-01-01T00:00:00.000Z") },
    });

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: signRefreshToken(userId, jti) });

    expect(response.status).toBe(401);
  });

  it("logs out and invalidates the refresh token", async () => {
    const payload = verifyRefreshToken(refreshToken);
    const out = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken });
    expect(out.status).toBe(204);

    await expect(
      prisma.refreshSession.findUnique({ where: { jti: payload.jti } }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });

    const repeatedLogout = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken });
    expect(repeatedLogout.status).toBe(204);

    const after = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(after.status).toBe(401);
  });

  it("deletes refresh sessions when their user is deleted", async () => {
    const cascadeEmail = uniqueEmail("auth-cascade");
    const registered = await request(app).post("/api/v1/auth/register").send({
      email: cascadeEmail,
      password,
      displayName: "Cascade Player",
    });
    expect(registered.status).toBe(201);

    const payload = verifyRefreshToken(registered.body.refreshToken);
    await prisma.user.delete({ where: { id: registered.body.user.id } });

    await expect(
      prisma.refreshSession.findUnique({ where: { jti: payload.jti } }),
    ).resolves.toBeNull();
  });
});
