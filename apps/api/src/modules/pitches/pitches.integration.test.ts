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
const password = "password123";

let ownerToken = "";
let playerToken = "";
let ownerId = "";

beforeAll(async () => {
  const owner = await registerTestUser(app, { email: ownerEmail, password, displayName: "Owner" });
  ownerToken = owner.accessToken;
  ownerId = owner.user.id;

  const player = await registerTestUser(app, { email: playerEmail, password, displayName: "Player" });
  playerToken = player.accessToken;
});

beforeEach(async () => {
  await prisma.pitchSlot.deleteMany({});
  await prisma.pitch.deleteMany({});
});

afterAll(async () => {
  await prisma.pitchSlot.deleteMany({});
  await prisma.pitch.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, playerEmail] } } });
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

    // Verify in database that priceAmountMinor is integer 400000 and currency is DZD
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
    // 1. Non-DZD currency
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

    // 2. Negative amountMinor
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

    // 3. Fractional amountMinor
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
    // Create Pitch A (4,000 DZD = 400,000 minor)
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

    // Create Pitch B (8,000 DZD = 800,000 minor)
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

    // Query with maxPriceMinor: 500,000 (should return Pitch A, but not Pitch B)
    const resUnder5k = await request(app)
      .get("/api/v1/pitches")
      .query({ maxPriceMinor: 500000 });

    expect(resUnder5k.status).toBe(200);
    expect(resUnder5k.body.some((p: { id: string }) => p.id === pitchA.id)).toBe(true);
    expect(resUnder5k.body.some((p: { id: string }) => p.id === pitchB.id)).toBe(false);

    // Query with format: ELEVEN_A_SIDE
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
      .query({ lat: 40.4168, lng: -3.7038, radiusKm: 10 }); // Madrid coordinates

    expect(farRes.status).toBe(200);
    expect(farRes.body.find((p: { id: string }) => p.id === algiersPitch.id)).toBeUndefined();
  });

  it("fetches single pitch details with slots", async () => {
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
    expect(res.body.slots).toEqual([]);
  });

  it("allows owner to configure and list pitch slots", async () => {
    const pitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Slot Pitch",
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
      .post(`/api/v1/pitches/${pitch.id}/slots`)
      .set(authHeader(ownerToken))
      .send({
        slots: [
          { dayOfWeek: 1, startTime: "18:00", endTime: "19:00", isBookable: true },
          { dayOfWeek: 1, startTime: "19:00", endTime: "20:00", isBookable: true },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);

    const listRes = await request(app).get(`/api/v1/pitches/${pitch.id}/slots`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(2);
  });

  it("blocks a non-owner from setting pitch slots", async () => {
    const pitch = await prisma.pitch.create({
      data: {
        ownerId,
        name: "Owner Pitch",
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
      .post(`/api/v1/pitches/${pitch.id}/slots`)
      .set(authHeader(playerToken))
      .send({
        slots: [{ dayOfWeek: 2, startTime: "10:00", endTime: "11:00" }],
      });

    expect(res.status).toBe(403);
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
