import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { authHeader, disconnectTestDependencies, uniqueEmail } from "../../test/integration-helpers";

const app = createApp();
const email = uniqueEmail("auth");
const password = "password123";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await disconnectTestDependencies();
});

describe("auth flow (integration)", () => {
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
  });

  it("rejects duplicate registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, displayName: "Test Player" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email, password });
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
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTruthy();

    // The old refresh token is now single-use / revoked.
    const reuse = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(reuse.status).toBe(401);

    refreshToken = res.body.refreshToken;
  });

  it("logs out and invalidates the refresh token", async () => {
    const out = await request(app).post("/api/v1/auth/logout").send({ refreshToken });
    expect(out.status).toBe(204);

    const after = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(after.status).toBe(401);
  });
});
