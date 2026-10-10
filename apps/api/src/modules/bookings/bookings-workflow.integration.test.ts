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

describe("Bookings Workflow API (integration - M08-T07)", () => {
  const runId = randomUUID();
  const password = "password123";

  let pitchOwnerId: string;
  let pitchOwnerToken: string;
  let organizerId: string;
  let organizerToken: string;
  let opponentCaptainId: string;
  let opponentCaptainToken: string;
  let outsiderId: string;
  let outsiderToken: string;

  let pitchId: string;
  let challengerTeamId: string;
  let opponentTeamId: string;
  let challengeId: string;
  let secondChallengeId: string;
  let thirdChallengeId: string;

  const bookingStart = new Date("2026-11-05T18:00:00.000Z"); // Thursday 19:00 local (420 + 8*90 = 1140 min)
  const bookingEnd = new Date("2026-11-05T19:30:00.000Z"); // 90 min later
  const challengeWindowStart = new Date("2026-11-05T12:00:00.000Z");
  const challengeWindowEnd = new Date("2026-11-05T23:00:00.000Z");

  beforeAll(async () => {
    // 1. Create users
    const [pOwner, orgUser, oCap, outsider] = await Promise.all([
      prisma.user.create({
        data: {
          email: uniqueEmail(`owner_${runId}`),
          passwordHash: password,
          displayName: "Pitch Owner T07",
          roles: ["PITCH_OWNER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`org_${runId}`),
          passwordHash: password,
          displayName: "Organizer T07",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`ocap_${runId}`),
          passwordHash: password,
          displayName: "Opponent Captain T07",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`outsider_${runId}`),
          passwordHash: password,
          displayName: "Outsider User T07",
          roles: ["PLAYER"],
        },
      }),
    ]);

    pitchOwnerId = pOwner.id;
    pitchOwnerToken = signAccessToken({ userId: pitchOwnerId, roles: ["PITCH_OWNER"] });
    organizerId = orgUser.id;
    organizerToken = signAccessToken({ userId: organizerId, roles: ["PLAYER"] });
    opponentCaptainId = oCap.id;
    opponentCaptainToken = signAccessToken({ userId: opponentCaptainId, roles: ["PLAYER"] });
    outsiderId = outsider.id;
    outsiderToken = signAccessToken({ userId: outsiderId, roles: ["PLAYER"] });

    // 2. Create pitch
    const pitch = await prisma.pitch.create({
      data: {
        ownerId: pitchOwnerId,
        name: `Arena Algiers ${runId}`,
        description: "Official turf pitch",
        address: "123 Rue de la Liberté",
        city: "Algiers",
        lat: 36.7538,
        lng: 3.0588,
        surface: "ARTIFICIAL_TURF",
        size: "FIVE_A_SIDE",
        priceAmountMinor: 300000, // 3,000 DZD/h -> 90 min = 450,000 minor DZD
        currency: "DZD",
        amenities: ["LIGHTING", "CHANGING_ROOMS"],
      },
    });
    pitchId = pitch.id;

    // Pitch availability rules (all days 0-24h)
    for (let day = 0; day <= 6; day++) {
      await prisma.pitchAvailabilityRule.create({
        data: {
          pitchId,
          dayOfWeek: day,
          startMinute: 420,
          endMinute: 1440,
          timezone: "Africa/Algiers",
          isActive: true,
        },
      });
    }

    // 3. Create teams
    const [cTeam, oTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challenger United ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponent City ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
    ]);
    challengerTeamId = cTeam.id;
    opponentTeamId = oTeam.id;

    // Team memberships
    await Promise.all([
      prisma.teamMembership.create({
        data: {
          teamId: challengerTeamId,
          userId: organizerId,
          role: "CAPTAIN",
          status: "ACTIVE",
        },
      }),
      prisma.teamMembership.create({
        data: {
          teamId: opponentTeamId,
          userId: opponentCaptainId,
          role: "CAPTAIN",
          status: "ACTIVE",
        },
      }),
    ]);

    // Team availabilities
    const [cAvail1, oAvail1, cAvail2, oAvail2, cAvail3, oAvail3] = await Promise.all([
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: organizerId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: challengeWindowEnd,
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: challengeWindowEnd,
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: organizerId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: challengeWindowEnd,
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: challengeWindowEnd,
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: organizerId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: challengeWindowEnd,
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: challengeWindowEnd,
        },
      }),
    ]);

    // Match Challenges
    const [c1, c2, c3] = await Promise.all([
      prisma.matchChallenge.create({
        data: {
          challengerAvailabilityId: cAvail1.id,
          opponentAvailabilityId: oAvail1.id,
          challengerTeamId,
          opponentTeamId,
          organizerUserId: organizerId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          responseDeadline: new Date(Date.now() + 6 * 3600 * 1000),
          bookingDeadline: new Date(Date.now() + 18 * 3600 * 1000),
          status: "ACCEPTED",
        },
      }),
      prisma.matchChallenge.create({
        data: {
          challengerAvailabilityId: cAvail2.id,
          opponentAvailabilityId: oAvail2.id,
          challengerTeamId,
          opponentTeamId,
          organizerUserId: organizerId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          responseDeadline: new Date(Date.now() + 6 * 3600 * 1000),
          bookingDeadline: new Date(Date.now() + 18 * 3600 * 1000),
          status: "ACCEPTED",
        },
      }),
      prisma.matchChallenge.create({
        data: {
          challengerAvailabilityId: cAvail3.id,
          opponentAvailabilityId: oAvail3.id,
          challengerTeamId,
          opponentTeamId,
          organizerUserId: organizerId,
          format: "FIVE_A_SIDE",
          startAt: challengeWindowStart,
          endAt: challengeWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          responseDeadline: new Date(Date.now() + 6 * 3600 * 1000),
          bookingDeadline: new Date(Date.now() + 18 * 3600 * 1000),
          status: "ACCEPTED",
        },
      }),
    ]);

    challengeId = c1.id;
    secondChallengeId = c2.id;
    thirdChallengeId = c3.id;
  });

  afterAll(async () => {
    if (challengerTeamId && opponentTeamId) {
      await prisma.matchParticipant.deleteMany({
        where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
      });
      await prisma.match.deleteMany({
        where: {
          OR: [
            { homeTeamId: challengerTeamId },
            { awayTeamId: challengerTeamId },
            { homeTeamId: opponentTeamId },
            { awayTeamId: opponentTeamId },
          ],
        },
      });
    }
    if (pitchId) {
      await prisma.booking.deleteMany({
        where: {
          OR: [
            ...(challengerTeamId ? [{ challengerTeamId }] : []),
            ...(opponentTeamId ? [{ opponentTeamId }] : []),
            { pitchId },
          ],
        },
      });
    }
    await prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: { in: [organizerId, pitchOwnerId, opponentCaptainId, outsiderId].filter(Boolean) as string[] },
      },
    });
    const challenges = [challengeId, secondChallengeId, thirdChallengeId].filter(Boolean) as string[];
    if (challenges.length > 0) {
      await prisma.matchChallenge.deleteMany({
        where: { id: { in: challenges } },
      });
    }
    if (challengerTeamId && opponentTeamId) {
      await prisma.teamAvailability.deleteMany({
        where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
      });
    }
    if (pitchId) {
      await prisma.pitchAvailabilityRule.deleteMany({ where: { pitchId } });
      await prisma.pitch.deleteMany({ where: { id: pitchId } });
    }
    if (challengerTeamId && opponentTeamId) {
      await prisma.teamMembership.deleteMany({
        where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
      });
      await prisma.team.deleteMany({
        where: { id: { in: [challengerTeamId, opponentTeamId] } },
      });
    }
    const users = [pitchOwnerId, organizerId, opponentCaptainId, outsiderId].filter(Boolean) as string[];
    if (users.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: users } },
      });
    }

    await disconnectTestDependencies();
  });

  describe("Authentication and Authorization", () => {
    it("returns 401 UNAUTHORIZED when no token is provided", async () => {
      const dummyId = randomUUID();
      const routes = [
        request(app).post("/api/v1/bookings").send({}),
        request(app).get("/api/v1/bookings/mine"),
        request(app).get("/api/v1/bookings/owner"),
        request(app).get(`/api/v1/bookings/${dummyId}`),
        request(app).post(`/api/v1/bookings/${dummyId}/confirm`).send({}),
        request(app).post(`/api/v1/bookings/${dummyId}/decline`).send({}),
        request(app).post(`/api/v1/bookings/${dummyId}/cancel`).send({}),
      ];

      for (const req of routes) {
        const res = await req;
        expect(res.status).toBe(401);
      }
    });
  });

  describe("Idempotency-Key Header Requirement", () => {
    it("returns 400 VALIDATION_ERROR when Idempotency-Key is missing on create command", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader(organizerToken))
        .send({
          challengeId,
          pitchId,
          startAt: bookingStart.toISOString(),
          endAt: bookingEnd.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Idempotency-Key header is required");
    });

    it("returns 400 VALIDATION_ERROR when Idempotency-Key is empty or whitespace on create command", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader(organizerToken))
        .set("Idempotency-Key", "   ")
        .send({
          challengeId,
          pitchId,
          startAt: bookingStart.toISOString(),
          endAt: bookingEnd.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Idempotency-Key header is required");
    });

    it("returns 400 VALIDATION_ERROR when Idempotency-Key is missing on confirm decision", async () => {
      const dummyId = randomUUID();
      const res = await request(app)
        .post(`/api/v1/bookings/${dummyId}/confirm`)
        .set(authHeader(pitchOwnerToken))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Idempotency-Key header is required");
    });

    it("returns 400 VALIDATION_ERROR when Idempotency-Key is missing on decline decision", async () => {
      const dummyId = randomUUID();
      const res = await request(app)
        .post(`/api/v1/bookings/${dummyId}/decline`)
        .set(authHeader(pitchOwnerToken))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Idempotency-Key header is required");
    });
  });

  describe("Booking Creation & Detail Flow", () => {
    let createdBookingId: string;
    const createKey = `create-key-${randomUUID()}`;

    it("creates a booking request with 201 and exposes full fields", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader(organizerToken))
        .set("Idempotency-Key", createKey)
        .send({
          challengeId,
          pitchId,
          startAt: bookingStart.toISOString(),
          endAt: bookingEnd.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.status).toBe("PENDING_OWNER_CONFIRMATION");
      expect(res.body.paymentStatus).toBe("UNPAID");
      expect(res.body.pitchId).toBe(pitchId);
      expect(res.body.challengeId).toBe(challengeId);
      expect(res.body.organizerUserId).toBe(organizerId);
      expect(res.body.priceAmountMinor).toBe(450000);
      expect(res.body.currency).toBe("DZD");
      expect(res.body.confirmedAt).toBeNull();
      expect(res.body.declinedAt).toBeNull();
      expect(res.body.cancelledAt).toBeNull();

      createdBookingId = res.body.id;
    });

    it("returns the exact same booking on idempotent retry with identical key", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set(authHeader(organizerToken))
        .set("Idempotency-Key", createKey)
        .send({
          challengeId,
          pitchId,
          startAt: bookingStart.toISOString(),
          endAt: bookingEnd.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(createdBookingId);
    });

    it("exposes accepted-condition comparison, pitch summary, teams, deadlines, price, matchId, viewerPermissions in detail", async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${createdBookingId}`)
        .set(authHeader(organizerToken));

      expect(res.status).toBe(200);
      const detail = res.body;

      // Price & payment state
      expect(detail.priceAmountMinor).toBe(450000);
      expect(detail.currency).toBe("DZD");
      expect(detail.paymentStatus).toBe("UNPAID");
      expect(detail.status).toBe("PENDING_OWNER_CONFIRMATION");
      expect(detail.matchId).toBeNull();

      // Pitch public summary
      expect(detail.pitch).toBeDefined();
      expect(detail.pitch.id).toBe(pitchId);
      expect(detail.pitch.name).toContain("Arena Algiers");
      expect(detail.pitch.address).toBe("123 Rue de la Liberté");
      expect(detail.pitch.city).toBe("Algiers");
      expect(detail.pitch.surface).toBe("ARTIFICIAL_TURF");
      expect(detail.pitch.size).toBe("FIVE_A_SIDE");
      expect(detail.pitch.priceAmountMinor).toBe(300000);
      expect(detail.pitch.currency).toBe("DZD");

      // Teams
      expect(detail.challengerTeam).toBeDefined();
      expect(detail.challengerTeam.id).toBe(challengerTeamId);
      expect(detail.opponentTeam).toBeDefined();
      expect(detail.opponentTeam.id).toBe(opponentTeamId);

      // Deadlines
      expect(detail.ownerResponseDeadline).toBeDefined();
      expect(detail.createdAt).toBeDefined();

      // Accepted condition comparison
      const comp = detail.comparison ?? detail.acceptedConditions;
      expect(comp).toBeDefined();
      expect(comp.agreedFormat).toBe("FIVE_A_SIDE");
      expect(comp.pitchFormat).toBe("FIVE_A_SIDE");
      expect(comp.formatMatches).toBe(true);
      expect(comp.withinWindow).toBe(true);
      expect(comp.agreedRadiusKm).toBe(15);
      expect(comp.withinRadius).toBe(true);

      // Viewer permissions for organizer
      expect(detail.viewerPermissions).toEqual({
        canConfirm: false,
        canDecline: false,
        canCancel: true,
      });
    });

    it("evaluates viewer permissions correctly for pitch owner", async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${createdBookingId}`)
        .set(authHeader(pitchOwnerToken));

      expect(res.status).toBe(200);
      expect(res.body.viewerPermissions).toEqual({
        canConfirm: true,
        canDecline: true,
        canCancel: false,
      });
    });

    it("evaluates viewer permissions correctly for opponent captain", async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${createdBookingId}`)
        .set(authHeader(opponentCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.viewerPermissions).toEqual({
        canConfirm: false,
        canDecline: false,
        canCancel: false,
      });
    });

    it("returns 403 FORBIDDEN when unrelated user attempts to view booking", async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${createdBookingId}`)
        .set(authHeader(outsiderToken));

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });

  describe("Ownership & Action Permissions", () => {
    let testBookingId: string;

    beforeAll(async () => {
      const slot2Start = new Date("2026-11-05T19:30:00.000Z");
      const slot2End = new Date("2026-11-05T21:00:00.000Z");

      const b = await prisma.booking.create({
        data: {
          pitchId,
          challengeId: secondChallengeId,
          organizerUserId: organizerId,
          challengerTeamId,
          opponentTeamId,
          startAt: slot2Start,
          endAt: slot2End,
          priceAmountMinor: 450000,
          currency: "DZD",
          status: "PENDING_OWNER_CONFIRMATION",
          paymentStatus: "UNPAID",
          ownerResponseDeadline: new Date(Date.now() + 10 * 3600 * 1000),
        },
      });
      testBookingId = b.id;
    });

    it("rejects confirmation when non-pitch-owner attempts it", async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/confirm`)
        .set(authHeader(organizerToken))
        .set("Idempotency-Key", randomUUID())
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("rejects decline when non-pitch-owner attempts it", async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/decline`)
        .set(authHeader(organizerToken))
        .set("Idempotency-Key", randomUUID())
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("rejects pre-confirmation cancel when non-organizer attempts it", async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/cancel`)
        .set(authHeader(opponentCaptainToken))
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("allows pitch owner to confirm booking and exposes matchId afterwards", async () => {
      const confirmKey = `confirm-key-${randomUUID()}`;
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/confirm`)
        .set(authHeader(pitchOwnerToken))
        .set("Idempotency-Key", confirmKey)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CONFIRMED");
      expect(res.body.confirmedAt).toBeDefined();

      // Retrieve detail and verify matchId is populated
      const detailRes = await request(app)
        .get(`/api/v1/bookings/${testBookingId}`)
        .set(authHeader(pitchOwnerToken));

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.status).toBe("CONFIRMED");
      expect(detailRes.body.matchId).toBeTruthy();

      // Retry confirm is idempotent
      const retryRes = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/confirm`)
        .set(authHeader(pitchOwnerToken))
        .set("Idempotency-Key", confirmKey)
        .send({});

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.status).toBe("CONFIRMED");
    });

    it("allows captain to cancel confirmed match before start", async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/cancel`)
        .set(authHeader(organizerToken))
        .send({ reason: "Unforeseen event" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED_BY_TEAM");
      expect(res.body.responsibleTeamId).toBe(challengerTeamId);

      // Verify the associated match is CANCELLED
      const match = await prisma.match.findUnique({
        where: { bookingId: testBookingId },
      });
      expect(match?.status).toBe("CANCELLED");
    });
  });

  describe("Decline Workflow", () => {
    let declineBookingId: string;

    beforeAll(async () => {
      const slot3Start = new Date(bookingStart.getTime() + 4 * 3600 * 1000);
      const slot3End = new Date(slot3Start.getTime() + 90 * 60 * 1000);

      const b = await prisma.booking.create({
        data: {
          pitchId,
          challengeId: thirdChallengeId,
          organizerUserId: organizerId,
          challengerTeamId,
          opponentTeamId,
          startAt: slot3Start,
          endAt: slot3End,
          priceAmountMinor: 450000,
          currency: "DZD",
          status: "PENDING_OWNER_CONFIRMATION",
          paymentStatus: "UNPAID",
          ownerResponseDeadline: new Date(Date.now() + 10 * 3600 * 1000),
        },
      });
      declineBookingId = b.id;
    });

    it("allows pitch owner to decline booking with Idempotency-Key", async () => {
      const declineKey = `decline-key-${randomUUID()}`;
      const res = await request(app)
        .post(`/api/v1/bookings/${declineBookingId}/decline`)
        .set(authHeader(pitchOwnerToken))
        .set("Idempotency-Key", declineKey)
        .send({ reason: "Pitch undergoing unscheduled turf maintenance" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DECLINED");
      expect(res.body.declinedAt).toBeDefined();

      // Retry decline is idempotent
      const retryRes = await request(app)
        .post(`/api/v1/bookings/${declineBookingId}/decline`)
        .set(authHeader(pitchOwnerToken))
        .set("Idempotency-Key", declineKey)
        .send({ reason: "Pitch undergoing unscheduled turf maintenance" });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.status).toBe("DECLINED");
    });
  });

  describe("List Bookings & Pagination", () => {
    it("GET /api/v1/bookings/mine returns organizer bookings with pagination", async () => {
      const res = await request(app)
        .get("/api/v1/bookings/mine?page=1&pageSize=2")
        .set(authHeader(organizerToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(2);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });

    it("GET /api/v1/bookings/owner returns pitch owner bookings", async () => {
      const res = await request(app)
        .get("/api/v1/bookings/owner?page=1&pageSize=10")
        .set(authHeader(pitchOwnerToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      // All returned items must belong to pitchId
      for (const item of res.body.items) {
        expect(item.pitch.id).toBe(pitchId);
      }
    });

    it("GET /api/v1/bookings/owner returns 0 items for an unrelated player", async () => {
      const res = await request(app)
        .get("/api/v1/bookings/owner")
        .set(authHeader(outsiderToken));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.items).toEqual([]);
    });
  });
});
