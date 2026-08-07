import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";

const app = createApp();
const ts = Date.now();
const ownerEmail = `pitch_owner_${ts}@test.com`;
const playerEmail = `pitch_player_${ts}@test.com`;
const password = "password123";

let ownerToken = "";
let playerToken = "";
let pitchId = "";

async function register(email: string, displayName: string) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password, displayName });
  return res.body as { accessToken: string; user: { id: string } };
}

beforeAll(async () => {
  const owner = await register(ownerEmail, "Owner");
  ownerToken = owner.accessToken;
  const player = await register(playerEmail, "Player");
  playerToken = player.accessToken;
});

afterAll(async () => {
  if (pitchId) {
    await prisma.pitchSlot.deleteMany({ where: { pitchId } });
    await prisma.pitch.deleteMany({ where: { id: pitchId } });
  }
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, playerEmail] } } });
  await prisma.$disconnect();
  redis.disconnect();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("pitches flow (integration)", () => {
  it("creates a pitch as an owner", async () => {
    const res = await request(app)
      .post("/api/v1/pitches")
      .set(auth(ownerToken))
      .send({
        name: "Camp Nou Amateur",
        description: "Great turf pitch",
        address: "123 Stadium Ave",
        city: "Barcelona",
        lat: 41.3809,
        lng: 2.1228,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        pricePerHour: 80,
        amenities: ["SHOWERS", "PARKING", "LIGHTS"],
        photos: ["https://example.com/pitch.jpg"],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Camp Nou Amateur");
    expect(res.body.surface).toBe("ARTIFICIAL_TURF");
    expect(res.body.size).toBe("SEVEN_A_SIDE");
    expect(res.body.pricePerHour).toBe(80);
    pitchId = res.body.id;
  });

  it("lists pitches with search query", async () => {
    const res = await request(app)
      .get("/api/v1/pitches")
      .query({ city: "Barcelona", maxPrice: 100 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(pitchId);
  });

  it("filters pitches by distance radius", async () => {
    const res = await request(app)
      .get("/api/v1/pitches")
      .query({ lat: 41.38, lng: 2.12, radiusKm: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const farRes = await request(app)
      .get("/api/v1/pitches")
      .query({ lat: 40.4168, lng: -3.7038, radiusKm: 10 }); // Madrid coordinates

    expect(farRes.status).toBe(200);
    expect(farRes.body.find((p: { id: string }) => p.id === pitchId)).toBeUndefined();
  });

  it("fetches single pitch details", async () => {
    const res = await request(app).get(`/api/v1/pitches/${pitchId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pitchId);
    expect(res.body.slots).toEqual([]);
  });

  it("allows owner to configure pitch slots", async () => {
    const res = await request(app)
      .post(`/api/v1/pitches/${pitchId}/slots`)
      .set(auth(ownerToken))
      .send({
        slots: [
          { dayOfWeek: 1, startTime: "18:00", endTime: "19:00", isBookable: true },
          { dayOfWeek: 1, startTime: "19:00", endTime: "20:00", isBookable: true },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
  });

  it("blocks a non-owner from setting pitch slots", async () => {
    const res = await request(app)
      .post(`/api/v1/pitches/${pitchId}/slots`)
      .set(auth(playerToken))
      .send({
        slots: [{ dayOfWeek: 2, startTime: "10:00", endTime: "11:00" }],
      });

    expect(res.status).toBe(403);
  });

  it("lists pitch slots publicly", async () => {
    const res = await request(app).get(`/api/v1/pitches/${pitchId}/slots`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("allows owner to update pitch details", async () => {
    const res = await request(app)
      .patch(`/api/v1/pitches/${pitchId}`)
      .set(auth(ownerToken))
      .send({ pricePerHour: 90 });

    expect(res.status).toBe(200);
    expect(res.body.pricePerHour).toBe(90);
  });
});
