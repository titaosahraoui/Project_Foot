import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  disconnectTestDependencies,
  registerTestUser,
} from "../../test/integration-helpers";

const app = createApp();
let userId = "";
let accessToken = "";

beforeAll(async () => {
  const registered = await registerTestUser(app, {
    displayName: "Profile Player",
  });
  userId = registered.user.id;
  accessToken = registered.accessToken;
});

afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await disconnectTestDependencies();
});

describe("player profile API (integration)", () => {
  it.each(["get", "patch"] as const)(
    "rejects unauthenticated %s access",
    async (method) => {
      const response = await request(app)[method]("/api/v1/users/me").send({});

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHENTICATED");
    },
  );

  it("returns a safe canonical profile", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set(authHeader(accessToken));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: userId,
      displayName: "Profile Player",
      position: null,
      lat: null,
      lng: null,
    });
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(response.body).not.toHaveProperty("refreshSessions");
  });

  it("updates canonical profile fields and trims displayName", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set(authHeader(accessToken))
      .send({
        displayName: "  Amina Keeper  ",
        position: "GK",
        skillLevel: "ADVANCED",
        bio: "Available for evening matches.",
        avatarUrl: "https://example.com/amina.png",
        lat: 36.7538,
        lng: 3.0588,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      displayName: "Amina Keeper",
      position: "GK",
      skillLevel: "ADVANCED",
      bio: "Available for evening matches.",
      avatarUrl: "https://example.com/amina.png",
      lat: 36.7538,
      lng: 3.0588,
    });
  });

  it("clears nullable profile fields explicitly", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set(authHeader(accessToken))
      .send({
        position: null,
        skillLevel: null,
        bio: null,
        avatarUrl: null,
        lat: null,
        lng: null,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      position: null,
      skillLevel: null,
      bio: null,
      avatarUrl: null,
      lat: null,
      lng: null,
    });
  });

  it("rejects a non-canonical position", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set(authHeader(accessToken))
      .send({ position: "ST" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a partial coordinate update", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set(authHeader(accessToken))
      .send({ lat: 36.75 });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
