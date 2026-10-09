import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { signAccessToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  disconnectTestDependencies,
  uniqueEmail,
} from "../../test/integration-helpers";

const app = createApp();

const password = "password123";
const HOUR_MS = 60 * 60 * 1000;

function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * HOUR_MS);
}

describe("Match Challenge API (integration)", () => {
  let challengerCaptainId: string;
  let challengerCaptainToken: string;
  let challengerMemberId: string;
  let challengerMemberToken: string;

  let opponentCaptainId: string;
  let opponentCaptainToken: string;
  let opponentMemberId: string;
  let opponentMemberToken: string;

  let outsiderId: string;
  let outsiderToken: string;

  let challengerTeamId: string;
  let opponentTeamId: string;

  let challengerAvailId1: string;
  let opponentAvailId1: string;

  let challengerAvailId2: string;
  let opponentAvailId2: string;

  let challengerAvailId3: string;
  let opponentAvailId3: string;

  let challengerAvailId4: string;
  let opponentAvailId4: string;


  beforeAll(async () => {
    // 1. Create users
    const uCapA = await prisma.user.create({
      data: {
        email: uniqueEmail("chal_cap"),
        passwordHash: password,
        displayName: "Challenger Captain",
      },
    });
    const uMemA = await prisma.user.create({
      data: {
        email: uniqueEmail("chal_mem"),
        passwordHash: password,
        displayName: "Challenger Member",
      },
    });
    const uCapB = await prisma.user.create({
      data: {
        email: uniqueEmail("opp_cap"),
        passwordHash: password,
        displayName: "Opponent Captain",
      },
    });
    const uMemB = await prisma.user.create({
      data: {
        email: uniqueEmail("opp_mem"),
        passwordHash: password,
        displayName: "Opponent Member",
      },
    });
    const uOut = await prisma.user.create({
      data: {
        email: uniqueEmail("outsider"),
        passwordHash: password,
        displayName: "Outsider",
      },
    });

    challengerCaptainId = uCapA.id;
    challengerCaptainToken = signAccessToken({
      userId: challengerCaptainId,
      roles: ["PLAYER"],
    });

    challengerMemberId = uMemA.id;
    challengerMemberToken = signAccessToken({
      userId: challengerMemberId,
      roles: ["PLAYER"],
    });

    opponentCaptainId = uCapB.id;
    opponentCaptainToken = signAccessToken({
      userId: opponentCaptainId,
      roles: ["PLAYER"],
    });

    opponentMemberId = uMemB.id;
    opponentMemberToken = signAccessToken({
      userId: opponentMemberId,
      roles: ["PLAYER"],
    });

    outsiderId = uOut.id;
    outsiderToken = signAccessToken({
      userId: outsiderId,
      roles: ["PLAYER"],
    });

    // 2. Create teams
    const teamARes = await request(app)
      .post("/api/v1/teams")
      .set(authHeader(challengerCaptainToken))
      .send({ name: `Challenger FC ${randomUUID().slice(0, 8)}` });
    challengerTeamId = teamARes.body.id;

    await prisma.teamMembership.create({
      data: {
        teamId: challengerTeamId,
        userId: challengerMemberId,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    const teamBRes = await request(app)
      .post("/api/v1/teams")
      .set(authHeader(opponentCaptainToken))
      .send({ name: `Opponent United ${randomUUID().slice(0, 8)}` });
    opponentTeamId = teamBRes.body.id;

    await prisma.teamMembership.create({
      data: {
        teamId: opponentTeamId,
        userId: opponentMemberId,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    // Set ratings so both teams have valid competitive profiles
    await prisma.teamRating.upsert({
      where: { teamId: challengerTeamId },
      update: { rating: 1200 },
      create: { teamId: challengerTeamId, rating: 1200 },
    });
    await prisma.teamRating.upsert({
      where: { teamId: opponentTeamId },
      update: { rating: 1200 },
      create: { teamId: opponentTeamId, rating: 1200 },
    });

    // 3. Create availabilities for different, non-overlapping windows (exclusion constraint safe)
    // Pair 1: Day 1 (10h - 12h from now)
    const start1 = futureDate(10);
    const end1 = futureDate(12);
    const availA1 = await prisma.teamAvailability.create({
      data: {
        teamId: challengerTeamId,
        createdById: challengerCaptainId,
        startAt: start1,
        endAt: end1,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start1,
      },
    });
    const availB1 = await prisma.teamAvailability.create({
      data: {
        teamId: opponentTeamId,
        createdById: opponentCaptainId,
        startAt: start1,
        endAt: end1,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start1,
      },
    });
    challengerAvailId1 = availA1.id;
    opponentAvailId1 = availB1.id;

    // Pair 2: Day 2 (30h - 32h from now)
    const start2 = futureDate(30);
    const end2 = futureDate(32);
    const availA2 = await prisma.teamAvailability.create({
      data: {
        teamId: challengerTeamId,
        createdById: challengerCaptainId,
        startAt: start2,
        endAt: end2,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start2,
      },
    });
    const availB2 = await prisma.teamAvailability.create({
      data: {
        teamId: opponentTeamId,
        createdById: opponentCaptainId,
        startAt: start2,
        endAt: end2,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start2,
      },
    });
    challengerAvailId2 = availA2.id;
    opponentAvailId2 = availB2.id;

    // Pair 3: Day 3 (50h - 52h from now)
    const start3 = futureDate(50);
    const end3 = futureDate(52);
    const availA3 = await prisma.teamAvailability.create({
      data: {
        teamId: challengerTeamId,
        createdById: challengerCaptainId,
        startAt: start3,
        endAt: end3,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start3,
      },
    });
    const availB3 = await prisma.teamAvailability.create({
      data: {
        teamId: opponentTeamId,
        createdById: opponentCaptainId,
        startAt: start3,
        endAt: end3,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start3,
      },
    });
    challengerAvailId3 = availA3.id;
    opponentAvailId3 = availB3.id;

    // Pair 4: Day 4 (70h - 72h from now)
    const start4 = futureDate(70);
    const end4 = futureDate(72);
    const availA4 = await prisma.teamAvailability.create({
      data: {
        teamId: challengerTeamId,
        createdById: challengerCaptainId,
        startAt: start4,
        endAt: end4,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start4,
      },
    });
    const availB4 = await prisma.teamAvailability.create({
      data: {
        teamId: opponentTeamId,
        createdById: opponentCaptainId,
        startAt: start4,
        endAt: end4,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: start4,
      },
    });
    challengerAvailId4 = availA4.id;
    opponentAvailId4 = availB4.id;
  });


  afterAll(async () => {
    await disconnectTestDependencies();
  });

  describe("POST /api/v1/matchmaking/challenges", () => {
    it("rejects request when Idempotency-Key is missing", async () => {
      const res = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .send({
          challengerAvailabilityId: challengerAvailId1,
          opponentAvailabilityId: opponentAvailId1,
          message: "Let's play!",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects request when Idempotency-Key is empty or whitespace", async () => {
      const res = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .set("Idempotency-Key", "   ")
        .send({
          challengerAvailabilityId: challengerAvailId1,
          opponentAvailabilityId: opponentAvailId1,
          message: "Let's play!",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects creation if actor is not the captain of the challenger team", async () => {
      const key = randomUUID();
      const res = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerMemberToken))
        .set("Idempotency-Key", key)
        .send({
          challengerAvailabilityId: challengerAvailId1,
          opponentAvailabilityId: opponentAvailId1,
        });

      expect([403, 422]).toContain(res.status);
    });

    it("rejects creation if actor is an unrelated user", async () => {
      const key = randomUUID();
      const res = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(outsiderToken))
        .set("Idempotency-Key", key)
        .send({
          challengerAvailabilityId: challengerAvailId1,
          opponentAvailabilityId: opponentAvailId1,
        });

      expect([403, 422]).toContain(res.status);
    });

    it("creates challenge successfully and returns full detail with availableActions for organizer", async () => {
      const key = randomUUID();
      const res = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .set("Idempotency-Key", key)
        .send({
          challengerAvailabilityId: challengerAvailId1,
          opponentAvailabilityId: opponentAvailId1,
          message: "Match on day 1!",
        });

      expect(res.status).toBe(201);
      const challenge = res.body;

      expect(challenge.id).toBeDefined();
      expect(challenge.status).toBe("PENDING");
      expect(challenge.organizerUserId).toBe(challengerCaptainId);
      expect(challenge.challengerTeamId).toBe(challengerTeamId);
      expect(challenge.opponentTeamId).toBe(opponentTeamId);

      // Public team summaries included
      expect(challenge.challengerTeam.name).toContain("Challenger FC");
      expect(challenge.opponentTeam.name).toContain("Opponent United");
      expect(challenge.challengerTeam.elo).toBe(1200);
      expect(challenge.opponentTeam.elo).toBe(1200);

      // Snapshotted conditions and overlap window
      expect(challenge.conditions).toBeDefined();
      expect(challenge.conditions.format).toBe("FIVE_A_SIDE");
      expect(challenge.overlappingWindow.durationMinutes).toBe(120);

      // Deadlines
      expect(challenge.responseDeadline).toBeDefined();
      expect(challenge.bookingDeadline).toBeNull();

      // Available actions for organizer: CANCEL
      expect(challenge.availableActions).toEqual(["CANCEL"]);
    });

    it("returns identical response on idempotent retry with matching payload", async () => {
      const key = randomUUID();
      const payload = {
        challengerAvailabilityId: challengerAvailId2,
        opponentAvailabilityId: opponentAvailId2,
        message: "Match on day 2!",
      };

      const firstRes = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .set("Idempotency-Key", key)
        .send(payload);

      expect(firstRes.status).toBe(201);

      const retryRes = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .set("Idempotency-Key", key)
        .send(payload);

      expect(retryRes.status).toBe(201);
      expect(retryRes.body.id).toBe(firstRes.body.id);
      expect(retryRes.body.createdAt).toBe(firstRes.body.createdAt);
    });

    it("rejects retry with conflicting payload using same idempotency key", async () => {
      const key = randomUUID();
      const payload = {
        challengerAvailabilityId: challengerAvailId3,
        opponentAvailabilityId: opponentAvailId3,
        message: "Initial message",
      };

      const firstRes = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .set("Idempotency-Key", key)
        .send(payload);

      expect(firstRes.status).toBe(201);

      const conflictRes = await request(app)
        .post("/api/v1/matchmaking/challenges")
        .set(authHeader(challengerCaptainToken))
        .set("Idempotency-Key", key)
        .send({
          ...payload,
          message: "Different message attempting to reuse key",
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.code).toBe("CONFLICT");
    });
  });

  describe("GET /api/v1/matchmaking/challenges/:id", () => {
    let challengeId: string;

    beforeAll(async () => {
      // Find challenge 1 created above
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId1 },
      });
      challengeId = challenge.id;
    });

    it("allows opponent captain to view with ACCEPT and DECLINE actions", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${challengeId}`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(challengeId);
      expect(res.body.availableActions).toEqual(["ACCEPT", "DECLINE"]);
      expect(res.body.challengerTeam.name).toBeDefined();
      expect(res.body.opponentTeam.name).toBeDefined();
      expect(res.body.conditions).toBeDefined();
      expect(res.body.overlappingWindow).toBeDefined();
    });

    it("allows challenger captain (organizer) to view with CANCEL action", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${challengeId}`)
        .set(authHeader(challengerCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.availableActions).toEqual(["CANCEL"]);
    });

    it("allows challenger team member to view with empty availableActions", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${challengeId}`)
        .set(authHeader(challengerMemberToken));

      expect(res.status).toBe(200);
      expect(res.body.availableActions).toEqual([]);
    });

    it("allows opponent team member to view with empty availableActions", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${challengeId}`)
        .set(authHeader(opponentMemberToken));

      expect(res.status).toBe(200);
      expect(res.body.availableActions).toEqual([]);
    });

    it("forbids unrelated user from viewing challenge", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${challengeId}`)
        .set(authHeader(outsiderToken));

      expect(res.status).toBe(403);
    });

    it("returns 404 for unknown challenge id", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${randomUUID()}`)
        .set(authHeader(challengerCaptainToken));

      expect(res.status).toBe(404);
    });
  });

  describe("Lifecycle actions: POST /:id/accept, /:id/decline, /:id/cancel", () => {
    it("forbids challenger captain or members from accepting challenge", async () => {
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId1 },
      });

      // Challenger captain cannot accept
      const resCap = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/accept`)
        .set(authHeader(challengerCaptainToken));
      expect(resCap.status).toBe(403);

      // Challenger member cannot accept
      const resMem = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/accept`)
        .set(authHeader(challengerMemberToken));
      expect(resMem.status).toBe(403);

      // Opponent member cannot accept (only opponent captain)
      const resOppMem = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/accept`)
        .set(authHeader(opponentMemberToken));
      expect(resOppMem.status).toBe(403);
    });

    it("allows opponent captain to accept, updates state, and computes bookingDeadline", async () => {
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId1 },
      });

      const res = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/accept`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACCEPTED");
      expect(res.body.respondedAt).toBeDefined();
      expect(res.body.bookingDeadline).toBeDefined();

      // For opponent captain, available actions is now empty
      expect(res.body.availableActions).toEqual([]);

      // For organizer viewing the accepted challenge, available action is CANCEL
      const getRes = await request(app)
        .get(`/api/v1/matchmaking/challenges/${challenge.id}`)
        .set(authHeader(challengerCaptainToken));
      expect(getRes.body.availableActions).toEqual(["CANCEL"]);
    });

    it("is idempotent when accept is called again on already accepted challenge", async () => {
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId1 },
      });

      const res = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/accept`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACCEPTED");
    });

    it("forbids non-organizer from cancelling challenge", async () => {
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId1 },
      });

      // Opponent captain cannot cancel
      const resOpp = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/cancel`)
        .set(authHeader(opponentCaptainToken));
      expect(resOpp.status).toBe(403);

      // Challenger member cannot cancel
      const resMem = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/cancel`)
        .set(authHeader(challengerMemberToken));
      expect(resMem.status).toBe(403);
    });

    it("allows organizer to cancel accepted challenge and is idempotent", async () => {
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId1 },
      });

      const res = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/cancel`)
        .set(authHeader(challengerCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
      expect(res.body.cancelledAt).toBeDefined();
      expect(res.body.availableActions).toEqual([]);

      // Retry is idempotent
      const retryRes = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/cancel`)
        .set(authHeader(challengerCaptainToken));
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.status).toBe("CANCELLED");
    });

    it("allows opponent captain to decline a pending challenge and is idempotent", async () => {
      const challenge = await prisma.matchChallenge.findFirstOrThrow({
        where: { challengerAvailabilityId: challengerAvailId2 },
      });
      expect(challenge.status).toBe("PENDING");

      const res = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/decline`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DECLINED");
      expect(res.body.respondedAt).toBeDefined();
      expect(res.body.availableActions).toEqual([]);

      // Retry is idempotent
      const retryRes = await request(app)
        .post(`/api/v1/matchmaking/challenges/${challenge.id}/decline`)
        .set(authHeader(opponentCaptainToken));
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.status).toBe("DECLINED");
    });
  });

  describe("Expired challenge access", () => {
    let expiredChallengeId: string;

    beforeAll(async () => {
      // Create a challenge directly in DB with responseDeadline in past
      const past = new Date(Date.now() - 2 * HOUR_MS);
      const expiredChallenge = await prisma.matchChallenge.create({
        data: {
          challengerTeamId,
          opponentTeamId,
          challengerAvailabilityId: challengerAvailId4,
          opponentAvailabilityId: opponentAvailId4,
          organizerUserId: challengerCaptainId,
          format: "FIVE_A_SIDE",
          startAt: futureDate(10),
          endAt: futureDate(12),
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          responseDeadline: past,
          bookingDeadline: null,
          status: "PENDING",
        },
      });
      expiredChallengeId = expiredChallenge.id;
    });

    it("marks challenge as EXPIRED upon viewing and yields empty availableActions", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/${expiredChallengeId}`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("EXPIRED");
      expect(res.body.availableActions).toEqual([]);
    });

    it("rejects accept attempt on expired challenge with 409", async () => {
      const res = await request(app)
        .post(`/api/v1/matchmaking/challenges/${expiredChallengeId}/accept`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(409);
    });
  });

  describe("Inbox and Outbox: static routes before /:id", () => {
    it("GET /challenges/inbox returns paginated challenges received by opponent team", async () => {
      const res = await request(app)
        .get("/api/v1/matchmaking/challenges/inbox")
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
      expect(res.body.total).toBeGreaterThanOrEqual(1);


      // Every item in inbox has opponentTeamId matching viewer's team
      for (const item of res.body.items) {
        expect(item.opponentTeamId).toBe(opponentTeamId);
        expect(item.challengerTeam.name).toBeDefined();
        expect(item.opponentTeam.name).toBeDefined();
        expect(item.availableActions).toBeDefined();
      }
    });

    it("GET /challenges/outbox returns paginated challenges sent by challenger team", async () => {
      const res = await request(app)
        .get("/api/v1/matchmaking/challenges/outbox")
        .set(authHeader(challengerCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.page).toBe(1);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      for (const item of res.body.items) {
        expect(item.challengerTeamId).toBe(challengerTeamId);
        expect(item.challengerTeam.name).toBeDefined();
        expect(item.opponentTeam.name).toBeDefined();
        expect(item.availableActions).toBeDefined();
      }
    });

    it("supports pagination params on inbox", async () => {
      const res = await request(app)
        .get("/api/v1/matchmaking/challenges/inbox?page=1&pageSize=1")
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.pageSize).toBe(1);
      expect(res.body.items.length).toBeLessThanOrEqual(1);
    });

    it("supports teamId and status filters on outbox", async () => {
      const res = await request(app)
        .get(`/api/v1/matchmaking/challenges/outbox?teamId=${challengerTeamId}&status=CANCELLED`)
        .set(authHeader(challengerCaptainToken));

      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        expect(item.challengerTeamId).toBe(challengerTeamId);
        expect(item.status).toBe("CANCELLED");
      }
    });
  });
});
