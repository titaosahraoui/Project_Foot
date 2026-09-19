import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  disconnectTestDependencies,
  registerTestUser,
  uniqueEmail,
} from "../../test/integration-helpers";

const app = createApp();
const ownerEmail = uniqueEmail("pitch_owner");
const playerEmail = uniqueEmail("pitch_player");
const otherOwnerEmail = uniqueEmail("other_pitch_owner");
const password = "password123";

let ownerToken = "";
let playerToken = "";
let otherOwnerToken = "";
let ownerId = "";

beforeAll(async () => {
  const owner = await registerTestUser(app, { email: ownerEmail, password, displayName: "Owner" });
  ownerToken = owner.accessToken;
  ownerId = owner.user.id;

  const player = await registerTestUser(app, { email: playerEmail, password, displayName: "Player" });
  playerToken = player.accessToken;

  const otherOwner = await registerTestUser(app, {
    email: otherOwnerEmail,
    password,
    displayName: "Other Owner",
  });
  otherOwnerToken = otherOwner.accessToken;
});

beforeEach(async () => {
  await prisma.pitchBlock.deleteMany({});
  await prisma.pitchAvailabilityRule.deleteMany({});
  await prisma.pitch.deleteMany({});
});

afterAll(async () => {
  await prisma.pitchBlock.deleteMany({});
  await prisma.pitchAvailabilityRule.deleteMany({});
  await prisma.pitch.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [ownerEmail, playerEmail, otherOwnerEmail] } },
  });
  await disconnectTestDependencies();
});

describe("pitches flow (integration - M05-T01)", () => {
  it("creates a pitch with explicit DZD Money hourlyRate and canonical format", async () => {
    const res = await request(app)
      .post("/api/v1/pitches")
      .set(authHeader(ownerToken))
      .send({
        name: "Stade 5 Juillet Amateur",
        description: "Great turf pitch under stadium floodlights",
        address: "123 Stadium Ave",
        city: "Algiers",
        lat: 36.7538,
        lng: 3.0588,
        surface: "ARTIFICIAL_TURF",
        format: "SEVEN_A_SIDE",
        hourlyRate: {
          amountMinor: 400000,
          currency: "DZD",
        },
        amenities: ["SHOWERS", "PARKING", "LIGHTS"],
        photos: ["https://example.com/pitch.jpg"],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Stade 5 Juillet Amateur");
    expect(res.body.surface).toBe("ARTIFICIAL_TURF");
    expect(res.body.format).toBe("SEVEN_A_SIDE");
    expect(res.body.size).toBe("SEVEN_A_SIDE");
    expect(res.body.hourlyRate).toEqual({
      amountMinor: 400000,
      currency: "DZD",
    });

    const dbPitch = await prisma.pitch.findUnique({ where: { id: res.body.id } });
    expect(dbPitch).not.toBeNull();
    expect(dbPitch?.priceAmountMinor).toBe(400000);
    expect(dbPitch?.currency).toBe("DZD");
  });

  it("supports deprecated size field as alias of format during creation", async () => {
    const res = await request(app)
      .post("/api/v1/pitches")
      .set(authHeader(ownerToken))
      .send({
        name: "Kouba Futsal Arena",
        address: "Route de Kouba",
        city: "Algiers",
        lat: 36.72,
        lng: 3.08,
        surface: "INDOOR_PARQUET",
        size: "FIVE_A_SIDE",
        hourlyRate: {
          amountMinor: 350000,
          currency: "DZD",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.format).toBe("FIVE_A_SIDE");
    expect(res.body.size).toBe("FIVE_A_SIDE");
    expect(res.body.hourlyRate).toEqual({
      amountMinor: 350000,
      currency: "DZD",
    });
  });

  it("rejects invalid money configurations (non-DZD, negative, fractional, unsafe)", async () => {
    const nonDzdRes = await request(app)
      .post("/api/v1/pitches")
      .set(authHeader(ownerToken))
      .send({
        name: "Test Currency",
        address: "123 Street",
        city: "Algiers",
        lat: 36.7,
        lng: 3.0,
        surface: "CONCRETE",
        format: "FIVE_A_SIDE",
        hourlyRate: {
          amountMinor: 4000,
          currency: "USD",
        },
      });
    expect(nonDzdRes.status).toBe(400);

    const negRes = await request(app)
      .post("/api/v1/pitches")
      .set(authHeader(ownerToken))
      .send({
        name: "Test Negative",
        address: "123 Street",
        city: "Algiers",
        lat: 36.7,
        lng: 3.0,
        surface: "CONCRETE",
        format: "FIVE_A_SIDE",
        hourlyRate: {
          amountMinor: -4000,
          currency: "DZD",
        },
      });
    expect(negRes.status).toBe(400);

    const fracRes = await request(app)
      .post("/api/v1/pitches")
      .set(authHeader(ownerToken))
      .send({
        name: "Test Fractional",
        address: "123 Street",
        city: "Algiers",
        lat: 36.7,
        lng: 3.0,
        surface: "CONCRETE",
        format: "FIVE_A_SIDE",
        hourlyRate: {
          amountMinor: 4000.5,
          currency: "DZD",
        },
      });
    expect(fracRes.status).toBe(400);
  });

  it("filters pitches by maxPrice in minor units and format", async () => {
    const pitchA = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Budget Pitch",
        address: "Algiers Center",
        city: "Algiers",
        lat: 36.75,
        lng: 3.05,
        surface: "ARTIFICIAL_TURF",
        size: "FIVE_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        isActive: true,
      },
    });

    const pitchB = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Premium Stadium",
        address: "Hydra",
        city: "Algiers",
        lat: 36.74,
        lng: 3.03,
        surface: "NATURAL_GRASS",
        size: "ELEVEN_A_SIDE",
        priceAmountMinor: 800000,
        currency: "DZD",
        isActive: true,
      },
    });

    const resUnder5k = await request(app)
      .get("/api/v1/pitches")
      .query({ maxPriceMinor: 500000 });

    expect(resUnder5k.status).toBe(200);
    expect(resUnder5k.body.some((p: { id: string }) => p.id === pitchA.id)).toBe(true);
    expect(resUnder5k.body.some((p: { id: string }) => p.id === pitchB.id)).toBe(false);

    const resFormat = await request(app)
      .get("/api/v1/pitches")
      .query({ format: "ELEVEN_A_SIDE" });

    expect(resFormat.status).toBe(200);
    expect(resFormat.body).toHaveLength(1);
    expect(resFormat.body[0].id).toBe(pitchB.id);
  });

  it("filters pitches by distance radius", async () => {
    const algiersPitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Algiers Center Pitch",
        address: "Didouche Mourad",
        city: "Algiers",
        lat: 36.7538,
        lng: 3.0588,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        isActive: true,
      },
    });

    const res = await request(app)
      .get("/api/v1/pitches")
      .query({ lat: 36.75, lng: 3.05, radiusKm: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(algiersPitch.id);

    const farRes = await request(app)
      .get("/api/v1/pitches")
      .query({ lat: 40.4168, lng: -3.7038, radiusKm: 10 });

    expect(farRes.status).toBe(200);
    expect(farRes.body.find((p: { id: string }) => p.id === algiersPitch.id)).toBeUndefined();
  });

  it("fetches single pitch details with availability rules", async () => {
    const pitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Arena Hub",
        address: "Dely Ibrahim",
        city: "Algiers",
        lat: 36.75,
        lng: 3.04,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        priceAmountMinor: 500000,
        currency: "DZD",
        isActive: true,
      },
    });

    const res = await request(app).get(`/api/v1/pitches/${pitch.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pitch.id);
    expect(res.body.hourlyRate).toEqual({
      amountMinor: 500000,
      currency: "DZD",
    });
    expect(res.body.availabilityRules).toEqual([]);
    expect(res.body.slots).toEqual([]);
  });

  it("allows owner to update pitch details including hourlyRate", async () => {
    const pitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Editable Pitch",
        address: "Address",
        city: "Algiers",
        lat: 36.75,
        lng: 3.04,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        isActive: true,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/pitches/${pitch.id}`)
      .set(authHeader(ownerToken))
      .send({
        hourlyRate: {
          amountMinor: 450000,
          currency: "DZD",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.hourlyRate).toEqual({
      amountMinor: 450000,
      currency: "DZD",
    });
  });
});

describe("pitches availability rules (integration - M05-T02)", () => {
  let testPitchId = "";

  beforeEach(async () => {
    const pitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Olympic Complex Pitch",
        address: "Route de Ben Aknoun",
        city: "Algiers",
        lat: 36.76,
        lng: 3.02,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        priceAmountMinor: 500000,
        currency: "DZD",
        isActive: true,
      },
    });
    testPitchId = pitch.id;
  });

  it("replaces availability rules in full and serializes local time as HH:mm with fixed Africa/Algiers timezone", async () => {
    const putRes = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [
          { dayOfWeek: 0, startMinute: 540, endMinute: 720, isActive: true }, // Sunday 09:00 - 12:00
          { dayOfWeek: 1, startTime: "18:00", endTime: "21:00", isActive: true }, // Monday 18:00 - 21:00 (1080 - 1260)
          { dayOfWeek: 5, startMinute: 840, endMinute: 1320, isActive: false }, // Friday 14:00 - 22:00 inactive
        ],
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveLength(3);

    // Rule 0: Sunday 09:00 - 12:00
    const r0 = putRes.body[0];
    expect(r0.dayOfWeek).toBe(0);
    expect(r0.startMinute).toBe(540);
    expect(r0.endMinute).toBe(720);
    expect(r0.startTime).toBe("09:00");
    expect(r0.endTime).toBe("12:00");
    expect(r0.timezone).toBe("Africa/Algiers");
    expect(r0.isActive).toBe(true);

    // Rule 1: Monday 18:00 - 21:00
    const r1 = putRes.body[1];
    expect(r1.dayOfWeek).toBe(1);
    expect(r1.startMinute).toBe(1080);
    expect(r1.endMinute).toBe(1260);
    expect(r1.startTime).toBe("18:00");
    expect(r1.endTime).toBe("21:00");
    expect(r1.timezone).toBe("Africa/Algiers");
    expect(r1.isActive).toBe(true);

    // Rule 2: Friday 14:00 - 22:00
    const r2 = putRes.body[2];
    expect(r2.dayOfWeek).toBe(5);
    expect(r2.startMinute).toBe(840);
    expect(r2.endMinute).toBe(1320);
    expect(r2.startTime).toBe("14:00");
    expect(r2.endTime).toBe("22:00");
    expect(r2.isActive).toBe(false);

    // Verify GET returns identical structure
    const getRes = await request(app).get(`/api/v1/pitches/${testPitchId}/availability-rules`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(3);
    expect(getRes.body).toEqual(putRes.body);

    // Verify PitchDetail also exposes the rules
    const detailRes = await request(app).get(`/api/v1/pitches/${testPitchId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.availabilityRules).toHaveLength(3);
    expect(detailRes.body.availabilityRules[0].startTime).toBe("09:00");
  });

  it("atomically replaces the entire rule set when updating", async () => {
    // 1. First PUT: 2 rules
    await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [
          { dayOfWeek: 1, startMinute: 600, endMinute: 720 },
          { dayOfWeek: 2, startMinute: 600, endMinute: 720 },
        ],
      });

    const get1 = await request(app).get(`/api/v1/pitches/${testPitchId}/availability-rules`);
    expect(get1.body).toHaveLength(2);

    // 2. Second PUT: 1 rule (should replace, not append)
    const put2 = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [{ dayOfWeek: 3, startMinute: 1000, endMinute: 1100 }],
      });

    expect(put2.status).toBe(200);
    expect(put2.body).toHaveLength(1);
    expect(put2.body[0].dayOfWeek).toBe(3);

    const get2 = await request(app).get(`/api/v1/pitches/${testPitchId}/availability-rules`);
    expect(get2.body).toHaveLength(1);
    expect(get2.body[0].dayOfWeek).toBe(3);
  });

  it("rejects endMinute <= startMinute with 400", async () => {
    const eqRes = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 600, endMinute: 600 }],
      });
    expect(eqRes.status).toBe(400);

    const revRes = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 700, endMinute: 600 }],
      });
    expect(revRes.status).toBe(400);
  });

  it("rejects rules shorter than 30 minutes with 400", async () => {
    const res = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 600, endMinute: 620 }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects overlapping active rules for the same pitch and day with 400", async () => {
    const res = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [
          { dayOfWeek: 1, startMinute: 600, endMinute: 720, isActive: true },
          { dayOfWeek: 1, startMinute: 690, endMinute: 800, isActive: true },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("allows non-overlapping active rules on the same day and overlapping inactive rules", async () => {
    const res = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [
          { dayOfWeek: 1, startMinute: 600, endMinute: 720, isActive: true },
          { dayOfWeek: 1, startMinute: 720, endMinute: 840, isActive: true },
          { dayOfWeek: 1, startMinute: 660, endMinute: 780, isActive: false },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it("blocks non-owner with 403 on PUT", async () => {
    const res1 = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(otherOwnerToken))
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 600, endMinute: 720 }],
      });
    expect(res1.status).toBe(403);

    const res2 = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(playerToken))
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 600, endMinute: 720 }],
      });
    expect(res2.status).toBe(403);
  });

  it("blocks unauthenticated requests with 401 on PUT", async () => {
    const res = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 600, endMinute: 720 }],
      });
    expect(res.status).toBe(401);
  });

  it("rolls back all changes if any rule in the transaction fails validation", async () => {
    await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [{ dayOfWeek: 1, startMinute: 600, endMinute: 720 }],
      });

    const badRes = await request(app)
      .put(`/api/v1/pitches/${testPitchId}/availability-rules`)
      .set(authHeader(ownerToken))
      .send({
        rules: [
          { dayOfWeek: 2, startMinute: 600, endMinute: 720, isActive: true },
          { dayOfWeek: 2, startMinute: 660, endMinute: 780, isActive: true },
        ],
      });
    expect(badRes.status).toBe(400);

    const checkRes = await request(app).get(`/api/v1/pitches/${testPitchId}/availability-rules`);
    expect(checkRes.body).toHaveLength(1);
    expect(checkRes.body[0].dayOfWeek).toBe(1);
  });

  it("supports deprecated slot routes for intermediate client backwards compatibility", async () => {
    const postRes = await request(app)
      .post(`/api/v1/pitches/${testPitchId}/slots`)
      .set(authHeader(ownerToken))
      .send({
        slots: [
          { dayOfWeek: 2, startTime: "18:00", endTime: "19:00", isBookable: true },
          { dayOfWeek: 2, startTime: "19:00", endTime: "20:00", isBookable: true },
        ],
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body).toHaveLength(2);
    expect(postRes.body[0].startTime).toBe("18:00");
    expect(postRes.body[0].endTime).toBe("19:00");

    const getSlotsRes = await request(app).get(`/api/v1/pitches/${testPitchId}/slots`);
    expect(getSlotsRes.status).toBe(200);
    expect(getSlotsRes.body).toHaveLength(2);
  });
});

describe("pitch blocks and available slots (integration - M05-T03)", () => {
  let pitchId = "";

  beforeEach(async () => {
    const pitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Hydra Football Complex",
        address: "Hydra Hill",
        city: "Algiers",
        lat: 36.75,
        lng: 3.03,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        isActive: true,
      },
    });
    pitchId = pitch.id;

    // Set recurring rule: Friday 09:00 - 12:00 Algiers (08:00 - 11:00 UTC)
    await prisma.pitchAvailabilityRule.create({
      data: {
        pitchId,
        dayOfWeek: 5, // Friday
        startMinute: 540,
        endMinute: 720,
        timezone: "Africa/Algiers",
        isActive: true,
      },
    });
  });

  it("allows owner to create a pitch block and blocks non-owners", async () => {
    const startAt = "2026-08-21T09:00:00.000Z";
    const endAt = "2026-08-21T10:00:00.000Z";

    // Non-owner gets 403
    const nonOwnerRes = await request(app)
      .post(`/api/v1/pitches/${pitchId}/blocks`)
      .set(authHeader(playerToken))
      .send({
        startAt,
        endAt,
        reason: "Unauthorized block attempt",
      });
    expect(nonOwnerRes.status).toBe(403);

    // Owner creates block successfully
    const ownerRes = await request(app)
      .post(`/api/v1/pitches/${pitchId}/blocks`)
      .set(authHeader(ownerToken))
      .send({
        startAt,
        endAt,
        reason: "Turf maintenance",
      });

    expect(ownerRes.status).toBe(201);
    expect(ownerRes.body.pitchId).toBe(pitchId);
    expect(ownerRes.body.startAt).toBe(startAt);
    expect(ownerRes.body.endAt).toBe(endAt);
    expect(ownerRes.body.reason).toBe("Turf maintenance");
    expect(ownerRes.body.cancelledAt).toBeNull();
    expect(ownerRes.body.createdById).toBe(ownerId);
  });

  it("rejects invalid block datetime range (endAt <= startAt)", async () => {
    const res = await request(app)
      .post(`/api/v1/pitches/${pitchId}/blocks`)
      .set(authHeader(ownerToken))
      .send({
        startAt: "2026-08-21T10:00:00.000Z",
        endAt: "2026-08-21T09:00:00.000Z",
      });
    expect(res.status).toBe(400);
  });

  it("allows owner to cancel a pitch block and blocks non-owners", async () => {
    const block = await prisma.pitchBlock.create({
      data: {
        pitchId,
        startAt: new Date("2026-08-21T09:00:00.000Z"),
        endAt: new Date("2026-08-21T10:00:00.000Z"),
        reason: "Temporary closure",
        createdById: ownerId,
      },
    });

    // Non-owner gets 403
    const nonOwnerRes = await request(app)
      .delete(`/api/v1/pitches/${pitchId}/blocks/${block.id}`)
      .set(authHeader(playerToken));
    expect(nonOwnerRes.status).toBe(403);

    // Owner cancels block
    const ownerRes = await request(app)
      .delete(`/api/v1/pitches/${pitchId}/blocks/${block.id}`)
      .set(authHeader(ownerToken));
    expect(ownerRes.status).toBe(204);

    const dbBlock = await prisma.pitchBlock.findUnique({ where: { id: block.id } });
    expect(dbBlock?.cancelledAt).not.toBeNull();
  });

  it("generates available slots in UTC, subtracts active blocks, and restores slots when block is cancelled", async () => {
    // 1. Initial slot query (no blocks): 3 slots of 60m (08:00-09:00, 09:00-10:00, 10:00-11:00 UTC)
    const initialRes = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-21T00:00:00.000Z",
        to: "2026-08-21T23:59:59.999Z",
        durationMinutes: 60,
      });

    expect(initialRes.status).toBe(200);
    expect(initialRes.body).toHaveLength(3);
    expect(initialRes.body[0].startAt).toBe("2026-08-21T08:00:00.000Z");
    expect(initialRes.body[0].price).toEqual({ amountMinor: 400000, currency: "DZD" });

    // 2. Owner blocks the middle slot (09:00-10:00 UTC)
    const blockRes = await request(app)
      .post(`/api/v1/pitches/${pitchId}/blocks`)
      .set(authHeader(ownerToken))
      .send({
        startAt: "2026-08-21T09:00:00.000Z",
        endAt: "2026-08-21T10:00:00.000Z",
        reason: "Irrigation",
      });
    expect(blockRes.status).toBe(201);
    const blockId = blockRes.body.id;

    // 3. Query slots again: only 2 slots remain
    const blockedRes = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-21T00:00:00.000Z",
        to: "2026-08-21T23:59:59.999Z",
        durationMinutes: 60,
      });

    expect(blockedRes.status).toBe(200);
    expect(blockedRes.body).toHaveLength(2);
    expect(blockedRes.body[0].startAt).toBe("2026-08-21T08:00:00.000Z");
    expect(blockedRes.body[1].startAt).toBe("2026-08-21T10:00:00.000Z");

    // 4. Cancel the block
    const deleteRes = await request(app)
      .delete(`/api/v1/pitches/${pitchId}/blocks/${blockId}`)
      .set(authHeader(ownerToken));
    expect(deleteRes.status).toBe(204);

    // 5. Query slots again: all 3 slots restored
    const restoredRes = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-21T00:00:00.000Z",
        to: "2026-08-21T23:59:59.999Z",
        durationMinutes: 60,
      });

    expect(restoredRes.status).toBe(200);
    expect(restoredRes.body).toHaveLength(3);
  });

  it("validates available-slots query parameters (rejects to <= from, > 31 days, invalid duration)", async () => {
    // to <= from
    const badRange = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-21T10:00:00.000Z",
        to: "2026-08-21T08:00:00.000Z",
      });
    expect(badRange.status).toBe(400);

    // Range > 31 days
    const rangeTooLong = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-09-15T00:00:00.000Z",
      });
    expect(rangeTooLong.status).toBe(400);

    // Duration < 30
    const durationShort = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-21T00:00:00.000Z",
        to: "2026-08-21T23:59:59.999Z",
        durationMinutes: 15,
      });
    expect(durationShort.status).toBe(400);

    // Duration > 180
    const durationLong = await request(app)
      .get(`/api/v1/pitches/${pitchId}/available-slots`)
      .query({
        from: "2026-08-21T00:00:00.000Z",
        to: "2026-08-21T23:59:59.999Z",
        durationMinutes: 240,
      });
    expect(durationLong.status).toBe(400);
  });
});
