import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  calculateChallengeBookingDeadline,
  calculateChallengeResponseDeadline,
} from "@footconnect/shared";

describe("match_challenges schema and migration (integration)", () => {
  const runId = randomUUID();
  let organizerId = "";
  let challengerCaptainId = "";
  let opponentCaptainId = "";
  let challengerTeamId = "";
  let opponentTeamId = "";
  let challengerAvailabilityId = "";
  let opponentAvailabilityId = "";

  const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const baseEnd = new Date(baseStart.getTime() + 2 * 60 * 60 * 1000);

  beforeAll(async () => {
    // 1. Create users
    const [organizer, cCaptain, oCaptain] = await Promise.all([
      prisma.user.create({
        data: {
          email: `organizer_${runId}@test.com`,
          passwordHash: "hash-org",
          displayName: "Organizer User",
        },
      }),
      prisma.user.create({
        data: {
          email: `challenger_${runId}@test.com`,
          passwordHash: "hash-c",
          displayName: "Challenger Captain",
        },
      }),
      prisma.user.create({
        data: {
          email: `opponent_${runId}@test.com`,
          passwordHash: "hash-o",
          displayName: "Opponent Captain",
        },
      }),
    ]);
    organizerId = organizer.id;
    challengerCaptainId = cCaptain.id;
    opponentCaptainId = oCaptain.id;

    // 2. Create teams
    const [challengerTeam, opponentTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challenger FC ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponent FC ${runId}`,
          lat: 36.76,
          lng: 3.06,
        },
      }),
    ]);
    challengerTeamId = challengerTeam.id;
    opponentTeamId = opponentTeam.id;

    // 3. Create memberships
    await Promise.all([
      prisma.teamMembership.create({
        data: {
          teamId: challengerTeamId,
          userId: challengerCaptainId,
          role: "CAPTAIN",
        },
      }),
      prisma.teamMembership.create({
        data: {
          teamId: opponentTeamId,
          userId: opponentCaptainId,
          role: "CAPTAIN",
        },
      }),
    ]);

    // 4. Create availabilities
    const [challengerAvail, opponentAvail] = await Promise.all([
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: challengerCaptainId,
          startAt: baseStart,
          endAt: baseEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 10,
          eloTolerance: 150,
          expiresAt: baseStart,
          status: "OPEN",
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          startAt: baseStart,
          endAt: baseEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.76,
          originLng: 3.06,
          radiusKm: 15,
          eloTolerance: 200,
          expiresAt: baseStart,
          status: "OPEN",
        },
      }),
    ]);
    challengerAvailabilityId = challengerAvail.id;
    opponentAvailabilityId = opponentAvail.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.matchChallenge.deleteMany({
      where: {
        OR: [
          { challengerTeamId: { in: [challengerTeamId, opponentTeamId] } },
          { opponentTeamId: { in: [challengerTeamId, opponentTeamId] } },
        ],
      },
    });
    await prisma.teamAvailability.deleteMany({
      where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
    });
    await prisma.teamMembership.deleteMany({
      where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
    });
    await prisma.team.deleteMany({
      where: { id: { in: [challengerTeamId, opponentTeamId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [organizerId, challengerCaptainId, opponentCaptainId] },
      },
    });
    await prisma.$disconnect();
  });

  function createChallengeData(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    const responseDeadline = calculateChallengeResponseDeadline(now, baseStart);
    return {
      challengerTeamId,
      opponentTeamId,
      challengerAvailabilityId,
      opponentAvailabilityId,
      organizerUserId: organizerId,
      format: "FIVE_A_SIDE" as const,
      startAt: baseStart,
      endAt: baseEnd,
      originLat: 36.7538,
      originLng: 3.0588,
      radiusKm: 10,
      responseDeadline,
      bookingDeadline: null,
      status: "PENDING" as const,
      message: "Ready for a friendly match!",
      ...overrides,
    };
  }

  it("verifies ChallengeStatus enum exists with expected labels in PostgreSQL", async () => {
    const rows = await prisma.$queryRaw<{ type: string; label: string }[]>`
      SELECT t.typname AS type, e.enumlabel AS label
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'ChallengeStatus'
      ORDER BY e.enumsortorder
    `;
    const labels = rows.map((r) => r.label);
    expect(labels).toEqual([
      "PENDING",
      "ACCEPTED",
      "DECLINED",
      "CANCELLED",
      "EXPIRED",
    ]);
  });

  it("persists a valid MatchChallenge with snapshotted conditions and nullable bookingDeadline", async () => {
    const challenge = await prisma.matchChallenge.create({
      data: createChallengeData(),
      include: {
        challengerTeam: true,
        opponentTeam: true,
        challengerAvailability: true,
        opponentAvailability: true,
        organizerUser: true,
      },
    });

    expect(challenge.id).toBeDefined();
    expect(challenge.status).toBe("PENDING");
    expect(challenge.bookingDeadline).toBeNull();
    expect(challenge.format).toBe("FIVE_A_SIDE");
    expect(challenge.originLat).toBeCloseTo(36.7538, 4);
    expect(challenge.originLng).toBeCloseTo(3.0588, 4);
    expect(challenge.radiusKm).toBe(10);
    expect(challenge.challengerTeam.name).toBe(`Challenger FC ${runId}`);
    expect(challenge.opponentTeam.name).toBe(`Opponent FC ${runId}`);
    expect(challenge.organizerUser.email).toBe(`organizer_${runId}@test.com`);

    // Clean up
    await prisma.matchChallenge.delete({ where: { id: challenge.id } });
  });

  it("enforces different teams at the database level via CHECK constraint", async () => {
    // Attempt to challenge own team
    await expect(
      prisma.matchChallenge.create({
        data: createChallengeData({
          opponentTeamId: challengerTeamId,
        }),
      }),
    ).rejects.toThrow();
  });

  it.each([
    ["endAt before or equal to startAt", { endAt: baseStart }],
    ["radiusKm below 1", { radiusKm: 0 }],
    ["radiusKm above 50", { radiusKm: 51 }],
    ["originLat below -90", { originLat: -90.1 }],
    ["originLat above 90", { originLat: 90.1 }],
    ["originLng below -180", { originLng: -180.1 }],
    ["originLng above 180", { originLng: 180.1 }],
  ])("rejects invalid snapshot condition: %s", async (_name, overrides) => {
    await expect(
      prisma.matchChallenge.create({
        data: createChallengeData(overrides),
      }),
    ).rejects.toThrow();
  });

  it("enforces one active PENDING challenge per ordered availability pair via partial unique index", async () => {
    const first = await prisma.matchChallenge.create({
      data: createChallengeData(),
    });
    expect(first.status).toBe("PENDING");

    // Second challenge for the exact same pair while first is PENDING must fail
    await expect(
      prisma.matchChallenge.create({
        data: createChallengeData(),
      }),
    ).rejects.toThrow();

    // Transition first challenge to DECLINED
    await prisma.matchChallenge.update({
      where: { id: first.id },
      data: {
        status: "DECLINED",
        respondedAt: new Date(),
      },
    });

    // Now a new PENDING challenge for the same pair is allowed
    const second = await prisma.matchChallenge.create({
      data: createChallengeData({
        message: "Second attempt with better terms",
      }),
    });
    expect(second.status).toBe("PENDING");
    expect(second.id).not.toBe(first.id);

    // Clean up
    await prisma.matchChallenge.deleteMany({
      where: { id: { in: [first.id, second.id] } },
    });
  });

  it("guarantees snapshot isolation: modifying availability does not alter challenge snapshot", async () => {
    const originalStart = new Date(baseStart.getTime());
    const originalEnd = new Date(baseEnd.getTime());

    const challenge = await prisma.matchChallenge.create({
      data: createChallengeData({
        startAt: originalStart,
        endAt: originalEnd,
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
      }),
    });

    // Update challenger availability window, message, and status
    await prisma.teamAvailability.update({
      where: { id: challengerAvailabilityId },
      data: {
        message: "Altered message after challenge sent",
        radiusKm: 25,
      },
    });

    // Re-fetch challenge
    const reloaded = await prisma.matchChallenge.findUniqueOrThrow({
      where: { id: challenge.id },
    });

    expect(reloaded.radiusKm).toBe(10);
    expect(reloaded.originLat).toBeCloseTo(36.7538, 4);
    expect(reloaded.originLng).toBeCloseTo(3.0588, 4);
    expect(reloaded.startAt.toISOString()).toBe(originalStart.toISOString());
    expect(reloaded.endAt.toISOString()).toBe(originalEnd.toISOString());

    // Clean up
    await prisma.matchChallenge.delete({ where: { id: challenge.id } });
  });

  it("sets bookingDeadline on acceptance according to lock deadline rules", async () => {
    const challenge = await prisma.matchChallenge.create({
      data: createChallengeData(),
    });
    expect(challenge.bookingDeadline).toBeNull();

    const acceptedAt = new Date();
    const bookingDeadline = calculateChallengeBookingDeadline(
      acceptedAt,
      challenge.startAt,
    );

    const updated = await prisma.matchChallenge.update({
      where: { id: challenge.id },
      data: {
        status: "ACCEPTED",
        respondedAt: acceptedAt,
        bookingDeadline,
      },
    });

    expect(updated.status).toBe("ACCEPTED");
    expect(updated.respondedAt).toBeDefined();
    expect(updated.bookingDeadline?.toISOString()).toBe(
      bookingDeadline.toISOString(),
    );

    // Clean up
    await prisma.matchChallenge.delete({ where: { id: challenge.id } });
  });
});
