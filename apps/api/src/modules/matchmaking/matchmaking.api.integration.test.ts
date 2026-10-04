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
const MINUTE_MS = 60 * 1000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

let capAToken = "";
let capAId = "";
let memAToken = "";
let _memAId = "";
let outsiderToken = "";
let _outsiderId = "";

let capBToken = "";
let capBId = "";
let capCToken = "";
let capCId = "";
let capDToken = "";
let capDId = "";

let teamAId = "";
let teamBId = "";
let teamCId = "";
let teamDId = "";

beforeAll(async () => {
  // 1. Create fixture users sequentially to reuse connection and avoid pooler limits
  const uCapA = await prisma.user.create({
    data: { email: uniqueEmail("capA"), passwordHash: password, displayName: "Captain A" },
  });
  const uMemA = await prisma.user.create({
    data: { email: uniqueEmail("memA"), passwordHash: password, displayName: "Member A" },
  });
  const uOut = await prisma.user.create({
    data: { email: uniqueEmail("out"), passwordHash: password, displayName: "Outsider" },
  });
  const uCapB = await prisma.user.create({
    data: { email: uniqueEmail("capB"), passwordHash: password, displayName: "Captain B" },
  });
  const uCapC = await prisma.user.create({
    data: { email: uniqueEmail("capC"), passwordHash: password, displayName: "Captain C" },
  });
  const uCapD = await prisma.user.create({
    data: { email: uniqueEmail("capD"), passwordHash: password, displayName: "Captain D" },
  });

  capAId = uCapA.id;
  capAToken = signAccessToken({ userId: capAId, roles: ["PLAYER"] });

  _memAId = uMemA.id;
  memAToken = signAccessToken({ userId: uMemA.id, roles: ["PLAYER"] });

  _outsiderId = uOut.id;
  outsiderToken = signAccessToken({ userId: uOut.id, roles: ["PLAYER"] });

  capBId = uCapB.id;
  capBToken = signAccessToken({ userId: capBId, roles: ["PLAYER"] });

  capCId = uCapC.id;
  capCToken = signAccessToken({ userId: capCId, roles: ["PLAYER"] });

  capDId = uCapD.id;
  capDToken = signAccessToken({ userId: capDId, roles: ["PLAYER"] });

  // 2. Create teams
  // Team A: Hydra (36.7441, 3.0422)
  const resTeamA = await request(app)
    .post("/api/v1/teams")
    .set(authHeader(capAToken))
    .send({ name: `Team A ${randomUUID().slice(0, 8)}` });
  teamAId = resTeamA.body.id;

  // Add Member A to Team A
  await prisma.teamMembership.create({
    data: {
      teamId: teamAId,
      userId: uMemA.id,
      role: "MEMBER",
      status: "ACTIVE",
    },
  });

  // Team B: Algiers Center (36.7538, 3.0588) (~1.83 km from Hydra)
  const resTeamB = await request(app)
    .post("/api/v1/teams")
    .set(authHeader(capBToken))
    .send({ name: `Team B ${randomUUID().slice(0, 8)}` });
  teamBId = resTeamB.body.id;

  // Team C: Bab Ezzouar (36.7167, 3.1833) (~12.95 km from Hydra)
  const resTeamC = await request(app)
    .post("/api/v1/teams")
    .set(authHeader(capCToken))
    .send({ name: `Team C ${randomUUID().slice(0, 8)}` });
  teamCId = resTeamC.body.id;

  // Team D: Algiers Center
  const resTeamD = await request(app)
    .post("/api/v1/teams")
    .set(authHeader(capDToken))
    .send({ name: `Team D ${randomUUID().slice(0, 8)}` });
  teamDId = resTeamD.body.id;
});

afterAll(async () => {
  await prisma.teamAvailability.deleteMany({
    where: { teamId: { in: [teamAId, teamBId, teamCId, teamDId] } },
  });
  await prisma.team.deleteMany({
    where: { id: { in: [teamAId, teamBId, teamCId, teamDId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [capAId, capBId, capCId, capDId, _memAId, _outsiderId] } },
  });
  await disconnectTestDependencies();
});

describe("POST /api/v1/matchmaking/availability", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .post("/api/v1/matchmaking/availability")
      .send({
        teamId: teamAId,
        startAt: iso(Date.now() + 10 * HOUR_MS),
        endAt: iso(Date.now() + 12 * HOUR_MS),
        format: "FIVE_A_SIDE",
        origin: { lat: 36.7538, lng: 3.0588 },
      });
    expect(res.status).toBe(401);
  });

  it("rejects non-captain team members with 403", async () => {
    const res = await request(app)
      .post("/api/v1/matchmaking/availability")
      .set(authHeader(memAToken))
      .send({
        teamId: teamAId,
        startAt: iso(Date.now() + 10 * HOUR_MS),
        endAt: iso(Date.now() + 12 * HOUR_MS),
        format: "FIVE_A_SIDE",
        origin: { lat: 36.7538, lng: 3.0588 },
      });
    expect(res.status).toBe(403);
  });

  it("rejects outsider users with 403", async () => {
    const res = await request(app)
      .post("/api/v1/matchmaking/availability")
      .set(authHeader(outsiderToken))
      .send({
        teamId: teamAId,
        startAt: iso(Date.now() + 10 * HOUR_MS),
        endAt: iso(Date.now() + 12 * HOUR_MS),
        format: "FIVE_A_SIDE",
        origin: { lat: 36.7538, lng: 3.0588 },
      });
    expect(res.status).toBe(403);
  });

  it("rejects invalid input schema (lead time < 6h) with 400", async () => {
    const res = await request(app)
      .post("/api/v1/matchmaking/availability")
      .set(authHeader(capAToken))
      .send({
        teamId: teamAId,
        startAt: iso(Date.now() + 2 * HOUR_MS), // only 2 hours ahead
        endAt: iso(Date.now() + 4 * HOUR_MS),
        format: "FIVE_A_SIDE",
        origin: { lat: 36.7538, lng: 3.0588 },
      });
    expect(res.status).toBe(400);
  });

  it("creates availability for active captain with 201 and sanitized approximate area", async () => {
    const start = Date.now() + 10 * HOUR_MS;
    const end = start + 90 * MINUTE_MS;
    const res = await request(app)
      .post("/api/v1/matchmaking/availability")
      .set(authHeader(capAToken))
      .send({
        teamId: teamAId,
        startAt: iso(start),
        endAt: iso(end),
        format: "FIVE_A_SIDE",
        origin: { lat: 36.753842, lng: 3.058819 },
        radiusKm: 15,
        eloTolerance: 200,
        message: "Friendly weekend match",
      });

    expect(res.status).toBe(201);
    expect(res.body.teamId).toBe(teamAId);
    expect(res.body.createdById).toBe(capAId);
    expect(res.body.format).toBe("FIVE_A_SIDE");
    expect(res.body.status).toBe("OPEN");
    expect(res.body.radiusKm).toBe(15);
    expect(res.body.eloTolerance).toBe(200);
    expect(res.body.message).toBe("Friendly weekend match");

    // Privacy verification: approximateArea present, raw originLat/originLng omitted
    expect(res.body.approximateArea).toEqual({ lat: 36.75, lng: 3.06 });
    expect(res.body.originLat).toBeUndefined();
    expect(res.body.originLng).toBeUndefined();
    expect(res.body.origin).toBeUndefined();
  });

  it("rejects overlapping OPEN availability for the same team with 409", async () => {
    const start = Date.now() + 10 * HOUR_MS + 30 * MINUTE_MS; // overlaps existing window
    const end = start + 60 * MINUTE_MS;
    const res = await request(app)
      .post("/api/v1/matchmaking/availability")
      .set(authHeader(capAToken))
      .send({
        teamId: teamAId,
        startAt: iso(start),
        endAt: iso(end),
        format: "FIVE_A_SIDE",
        origin: { lat: 36.7538, lng: 3.0588 },
      });
    expect(res.status).toBe(409);
  });

  it("rejects concurrent requests creating overlapping windows for the same team with 409", async () => {
    // Launch two requests concurrently for the exact same team and overlapping time window
    const start = Date.now() + 40 * HOUR_MS;
    const end = start + 90 * MINUTE_MS;

    const payload = {
      teamId: teamBId,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      format: "FIVE_A_SIDE",
      origin: { lat: 36.7538, lng: 3.0588 },
    };

    const [res1, res2] = await Promise.all([
      request(app)
        .post("/api/v1/matchmaking/availability")
        .set(authHeader(capBToken))
        .send(payload),
      request(app)
        .post("/api/v1/matchmaking/availability")
        .set(authHeader(capBToken))
        .send(payload),
    ]);

    // Exactly one should succeed with 201, and the other must be rejected with 409
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Ensure database only contains 1 created availability for this team in this window
    const count = await prisma.teamAvailability.count({
      where: {
        teamId: teamBId,
        status: "OPEN",
        startAt: new Date(start),
      },
    });
    expect(count).toBe(1);
  });
});

describe("GET /api/v1/matchmaking/availability/mine", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/v1/matchmaking/availability/mine");
    expect(res.status).toBe(401);
  });

  it("returns availabilities for captain's teams with 200", async () => {
    const res = await request(app)
      .get("/api/v1/matchmaking/availability/mine")
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((a: any) => a.teamId === teamAId)).toBe(true);
  });

  it("returns availabilities for non-captain team members with 200", async () => {
    const res = await request(app)
      .get("/api/v1/matchmaking/availability/mine")
      .set(authHeader(memAToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((a: any) => a.teamId === teamAId)).toBe(true);
  });

  it("returns empty array for user without teams", async () => {
    const res = await request(app)
      .get("/api/v1/matchmaking/availability/mine")
      .set(authHeader(outsiderToken));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("DELETE /api/v1/matchmaking/availability/:id", () => {
  let availabilityId = "";

  beforeAll(async () => {
    const start = Date.now() + 20 * HOUR_MS;
    const end = start + 90 * MINUTE_MS;
    const created = await prisma.teamAvailability.create({
      data: {
        teamId: teamAId,
        createdById: capAId,
        startAt: new Date(start),
        endAt: new Date(end),
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        status: "OPEN",
        expiresAt: new Date(start),
      },
    });
    availabilityId = created.id;
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).delete(
      `/api/v1/matchmaking/availability/${availabilityId}`,
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-captain member with 403", async () => {
    const res = await request(app)
      .delete(`/api/v1/matchmaking/availability/${availabilityId}`)
      .set(authHeader(memAToken));
    expect(res.status).toBe(403);
  });

  it("rejects outsider with 403", async () => {
    const res = await request(app)
      .delete(`/api/v1/matchmaking/availability/${availabilityId}`)
      .set(authHeader(outsiderToken));
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent availability id", async () => {
    const res = await request(app)
      .delete(`/api/v1/matchmaking/availability/${randomUUID()}`)
      .set(authHeader(capAToken));
    expect(res.status).toBe(404);
  });

  it("cancels availability with 200 for active captain", async () => {
    const res = await request(app)
      .delete(`/api/v1/matchmaking/availability/${availabilityId}`)
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(availabilityId);
    expect(res.body.status).toBe("CANCELLED");
    expect(res.body.cancelledAt).toBeDefined();
  });

  it("is idempotent: repeat DELETE returns 200 with CANCELLED status", async () => {
    const res = await request(app)
      .delete(`/api/v1/matchmaking/availability/${availabilityId}`)
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(availabilityId);
    expect(res.body.status).toBe("CANCELLED");
  });
});

describe("GET /api/v1/matchmaking/availability/:id", () => {
  let availabilityId = "";

  beforeAll(async () => {
    const start = Date.now() + 50 * HOUR_MS;
    const end = start + 90 * MINUTE_MS;
    const created = await prisma.teamAvailability.create({
      data: {
        teamId: teamAId,
        createdById: capAId,
        startAt: new Date(start),
        endAt: new Date(end),
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        status: "OPEN",
        expiresAt: new Date(start),
      },
    });
    availabilityId = created.id;
  });

  it("returns availability for team member with 200", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${availabilityId}`)
      .set(authHeader(memAToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(availabilityId);
    expect(res.body.teamId).toBe(teamAId);
  });

  it("rejects outsider with 403", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${availabilityId}`)
      .set(authHeader(outsiderToken));

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent availability id", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${randomUUID()}`)
      .set(authHeader(capAToken));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/matchmaking/availability/:id", () => {
  let patchAvailId = "";
  let patchStart = 0;
  let patchEnd = 0;

  beforeAll(async () => {
    patchStart = Date.now() + 60 * HOUR_MS;
    patchEnd = patchStart + 90 * MINUTE_MS;
    const created = await prisma.teamAvailability.create({
      data: {
        teamId: teamAId,
        createdById: capAId,
        startAt: new Date(patchStart),
        endAt: new Date(patchEnd),
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(patchStart),
      },
    });
    patchAvailId = created.id;
  });

  it("rejects non-captain with 403", async () => {
    const res = await request(app)
      .patch(`/api/v1/matchmaking/availability/${patchAvailId}`)
      .set(authHeader(memAToken))
      .send({ radiusKm: 25 });

    expect(res.status).toBe(403);
  });

  it("allows captain to update radius, elo tolerance, format, and message without conflict on same window", async () => {
    const res = await request(app)
      .patch(`/api/v1/matchmaking/availability/${patchAvailId}`)
      .set(authHeader(capAToken))
      .send({
        radiusKm: 25,
        eloTolerance: 200,
        format: "SEVEN_A_SIDE",
        message: "Updated friendly challenge",
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(patchAvailId);
    expect(res.body.radiusKm).toBe(25);
    expect(res.body.eloTolerance).toBe(200);
    expect(res.body.format).toBe("SEVEN_A_SIDE");
    expect(res.body.message).toBe("Updated friendly challenge");
  });

  it("returns 404 for nonexistent availability id", async () => {
    const res = await request(app)
      .patch(`/api/v1/matchmaking/availability/${randomUUID()}`)
      .set(authHeader(capAToken))
      .send({ radiusKm: 20 });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/matchmaking/availability/:id/recommendations", { timeout: 60000 }, () => {
  let searchAvailabilityId = "";
  let eligibleAvailBId = "";
  let _farAvailCId = "";
  let _mismatchAvailDId = "";
  let teamEId = "";
  let uEId = "";

  const recWindowStart =
    Date.now() + (1000 + Math.floor(Math.random() * 50000)) * HOUR_MS;
  const recWindowEnd = recWindowStart + 120 * MINUTE_MS;

  beforeAll(async () => {
    // Clean up fixture teams' existing OPEN availabilities for full isolation
    await prisma.teamAvailability.updateMany({
      where: {
        teamId: { in: [teamAId, teamBId, teamCId, teamDId] },
        status: "OPEN",
      },
      data: { status: "CANCELLED" },
    });

    // Searching availability: Team A (Hydra: 36.7441, 3.0422), radius 10 km, FIVE_A_SIDE
    const availA = await prisma.teamAvailability.create({
      data: {
        teamId: teamAId,
        createdById: capAId,
        startAt: new Date(recWindowStart),
        endAt: new Date(recWindowEnd),
        format: "FIVE_A_SIDE",
        originLat: 36.7441,
        originLng: 3.0422,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(recWindowStart),
      },
    });
    searchAvailabilityId = availA.id;

    // Candidate 1: Team B (Algiers Center: 36.7538, 3.0588, ~1.83 km away), radius 10 km, FIVE_A_SIDE, overlapping
    const availB = await prisma.teamAvailability.create({
      data: {
        teamId: teamBId,
        createdById: capBId,
        startAt: new Date(recWindowStart + 30 * MINUTE_MS),
        endAt: new Date(recWindowEnd + 30 * MINUTE_MS),
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(recWindowStart + 30 * MINUTE_MS),
      },
    });
    eligibleAvailBId = availB.id;

    // Candidate 2: Team C (Bab Ezzouar: 36.7167, 3.1833, ~12.95 km away), radius 10 km -> DISTANCE EXCEEDS RADIUS
    const availC = await prisma.teamAvailability.create({
      data: {
        teamId: teamCId,
        createdById: capCId,
        startAt: new Date(recWindowStart),
        endAt: new Date(recWindowEnd),
        format: "FIVE_A_SIDE",
        originLat: 36.7167,
        originLng: 3.1833,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(recWindowStart),
      },
    });
    _farAvailCId = availC.id;

    // Candidate 3: Team D (Algiers Center: ~1.83 km away), radius 10 km, FORMAT SEVEN_A_SIDE -> FORMAT MISMATCH
    const availD = await prisma.teamAvailability.create({
      data: {
        teamId: teamDId,
        createdById: capDId,
        startAt: new Date(recWindowStart),
        endAt: new Date(recWindowEnd),
        format: "SEVEN_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(recWindowStart),
      },
    });
    _mismatchAvailDId = availD.id;
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get(
      `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`,
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-captain team member with 403", async () => {
    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`,
      )
      .set(authHeader(memAToken));
    expect(res.status).toBe(403);
  });

  it("rejects outsider user with 403", async () => {
    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`,
      )
      .set(authHeader(outsiderToken));
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent availability id", async () => {
    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${randomUUID()}/recommendations`,
      )
      .set(authHeader(capAToken));
    expect(res.status).toBe(404);
  });

  it("returns eligible recommendations with team summary, rounded distance, 0-100 score, explanation, and reliability null", async () => {
    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`,
      )
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);

    const rec = res.body.items[0];
    expect(rec.availabilityId).toBe(eligibleAvailBId);
    expect(rec.team.id).toBe(teamBId);
    expect(typeof rec.team.name).toBe("string");
    expect(typeof rec.team.elo).toBe("number");
    expect(rec.format).toBe("FIVE_A_SIDE");

    // Overlapping window: startAt max, endAt min -> duration 90 minutes
    expect(rec.overlappingWindow.durationMinutes).toBe(90);
    expect(typeof rec.overlappingWindow.startAt).toBe("string");
    expect(typeof rec.overlappingWindow.endAt).toBe("string");

    // Distance rounded
    expect(rec.distanceKm).toBeGreaterThan(1.7);
    expect(rec.distanceKm).toBeLessThan(2.0);

    // Score 0-100 integer
    expect(rec.score).toBeGreaterThanOrEqual(0);
    expect(rec.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(rec.score)).toBe(true);

    // Explanation fields
    expect(rec.explanation).toBeDefined();
    expect(rec.explanation.eloDifference).toBeDefined();
    expect(rec.explanation.distanceKm).toBe(rec.distanceKm);
    expect(rec.explanation.format).toBe("FIVE_A_SIDE");
    expect(rec.explanation.overlapMinutes).toBe(90);

    // Reliability null (meaning NEW until milestone 10)
    expect(rec.reliability).toBeNull();

    // Privacy: raw coordinates must NEVER be exposed
    expect(rec.originLat).toBeUndefined();
    expect(rec.originLng).toBeUndefined();
    expect(rec.origin).toBeUndefined();
    expect(rec.team.lat).toBeUndefined();
    expect(rec.team.lng).toBeUndefined();
  });

  it("filters out own team, distance outliers, format mismatches, and inactive teams", async () => {
    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`,
      )
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);

    // Own team must not be included
    expect(candidateTeamIds).not.toContain(teamAId);

    // Team C (distance too far: ~12.9 km vs radius 10 km) must not be included
    expect(candidateTeamIds).not.toContain(teamCId);

    // Team D (format SEVEN_A_SIDE vs searching FIVE_A_SIDE) must not be included
    expect(candidateTeamIds).not.toContain(teamDId);
  });

  it("returns empty recommendations when availability is past its expiry/end deadline", async () => {
    // Create an availability that is stored as OPEN but has past expiry deadline
    const pastStart = Date.now() - 2 * HOUR_MS;
    const pastEnd = Date.now() - 1 * HOUR_MS;
    const expiredAvail = await prisma.teamAvailability.create({
      data: {
        teamId: teamAId,
        createdById: capAId,
        startAt: new Date(pastStart),
        endAt: new Date(pastEnd),
        format: "FIVE_A_SIDE",
        originLat: 36.7441,
        originLng: 3.0422,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(pastStart),
      },
    });

    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${expiredAvail.id}/recommendations`,
      )
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);

    // Clean up
    await prisma.teamAvailability.deleteMany({
      where: { id: expiredAvail.id },
    });
  });

  it("sorts deterministically by score descending, then distance ascending, then team ID", async () => {
    // Create two more candidates with identical Elo and format, but different distances and IDs
    const start = recWindowStart;
    const end = recWindowEnd;

    const uE = await prisma.user.create({
      data: { email: uniqueEmail("capE"), passwordHash: password, displayName: "Captain E" },
    });
    uEId = uE.id;
    const uEToken = signAccessToken({ userId: uE.id, roles: ["PLAYER"] });
    const resTeamE = await request(app)
      .post("/api/v1/teams")
      .set(authHeader(uEToken))
      .send({ name: `Team E ${randomUUID().slice(0, 8)}` });
    teamEId = resTeamE.body.id;

    // Team E: at Hydra (distance ~0 km from Team A)
    await prisma.teamAvailability.create({
      data: {
        teamId: teamEId,
        createdById: uE.id,
        startAt: new Date(start),
        endAt: new Date(end),
        format: "FIVE_A_SIDE",
        originLat: 36.7441,
        originLng: 3.0422,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(start),
      },
    });

    const res = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`,
      )
      .set(authHeader(capAToken));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);

    // Team E (distance ~0 km) should rank higher than Team B (distance ~1.8 km)
    const items = res.body.items;
    expect(items[0].team.id).toBe(teamEId);
    expect(items[0].score).toBeGreaterThanOrEqual(items[1].score);
    if (items[0].score === items[1].score) {
      expect(items[0].distanceKm).toBeLessThanOrEqual(items[1].distanceKm);
    }
  });

  it("supports pagination with page and pageSize", async () => {
    // Page 1 with pageSize 1
    const resP1 = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations?page=1&pageSize=1`,
      )
      .set(authHeader(capAToken));

    expect(resP1.status).toBe(200);
    expect(resP1.body.page).toBe(1);
    expect(resP1.body.pageSize).toBe(1);
    expect(resP1.body.total).toBe(2);
    expect(resP1.body.items).toHaveLength(1);

    // Page 2 with pageSize 1
    const resP2 = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations?page=2&pageSize=1`,
      )
      .set(authHeader(capAToken));

    expect(resP2.status).toBe(200);
    expect(resP2.body.page).toBe(2);
    expect(resP2.body.pageSize).toBe(1);
    expect(resP2.body.total).toBe(2);
    expect(resP2.body.items).toHaveLength(1);

    // Items must be distinct
    expect(resP1.body.items[0].team.id).not.toBe(resP2.body.items[0].team.id);

    // Page 3 with pageSize 1 (empty)
    const resP3 = await request(app)
      .get(
        `/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations?page=3&pageSize=1`,
      )
      .set(authHeader(capAToken));

    expect(resP3.status).toBe(200);
    expect(resP3.body.page).toBe(3);
    expect(resP3.body.items).toHaveLength(0);
  });

  afterAll(async () => {
    const teamIds = [teamAId, teamBId, teamCId, teamDId];
    if (teamEId) teamIds.push(teamEId);
    await prisma.teamAvailability.deleteMany({
      where: { teamId: { in: teamIds } },
    });
    if (uEId && teamEId) {
      await prisma.team.deleteMany({ where: { id: teamEId } });
      await prisma.user.deleteMany({ where: { id: uEId } });
    }
  });
});
