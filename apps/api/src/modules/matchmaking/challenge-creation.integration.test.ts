import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { calculateChallengeResponseDeadline } from "@footconnect/shared";
import { createChallenge } from "./matchmaking.service";
import { uniqueEmail } from "../../test/integration-helpers";

describe("createChallenge (integration)", () => {
  const runId = randomUUID();
  const password = "password123";

  let challengerCaptainId = "";
  let opponentCaptainId = "";
  let nonCaptainUserId = "";

  let challengerTeamId = "";
  let opponentTeamId = "";
  let noCaptainTeamId = "";

  let challengerAvailabilityId = "";
  let challengerAvailability2Id = "";
  let opponentAvailabilityId = "";
  let cancelledAvailabilityId = "";
  let noCaptainAvailabilityId = "";

  const baseNow = new Date("2026-10-10T10:00:00.000Z");
  // Challenger window: Oct 11 18:00 to 20:00 (Algiers center, radius 10km)
  const challengerStart = new Date("2026-10-11T18:00:00.000Z");
  const challengerEnd = new Date("2026-10-11T20:00:00.000Z");

  // Opponent window: Oct 11 18:30 to 20:30 (Algiers Hydra ~1.8km, radius 15km)
  const opponentStart = new Date("2026-10-11T18:30:00.000Z");
  const opponentEnd = new Date("2026-10-11T20:30:00.000Z");

  const createdChallengeIds: string[] = [];

  beforeAll(async () => {
    // 1. Create test users
    const [cCaptain, oCaptain, nonCaptain] = await Promise.all([
      prisma.user.create({
        data: {
          email: uniqueEmail(`cCap_${runId}`),
          passwordHash: password,
          displayName: "Challenger Captain",
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`oCap_${runId}`),
          passwordHash: password,
          displayName: "Opponent Captain",
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`nonCap_${runId}`),
          passwordHash: password,
          displayName: "Non Captain User",
        },
      }),
    ]);
    challengerCaptainId = cCaptain.id;
    opponentCaptainId = oCaptain.id;
    nonCaptainUserId = nonCaptain.id;

    // 2. Create test teams
    const [cTeam, oTeam, ncTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challengers ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponents ${runId}`,
          lat: 36.7441,
          lng: 3.0422,
        },
      }),
      prisma.team.create({
        data: {
          name: `No Captain Team ${runId}`,
          lat: 36.7441,
          lng: 3.0422,
        },
      }),
    ]);
    challengerTeamId = cTeam.id;
    opponentTeamId = oTeam.id;
    noCaptainTeamId = ncTeam.id;

    // 3. Assign team memberships
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
      prisma.teamMembership.create({
        data: {
          teamId: challengerTeamId,
          userId: nonCaptainUserId,
          role: "MEMBER",
        },
      }),
    ]);

    // 4. Create availabilities
    const [cAvail, cAvail2, oAvail, canAvail, ncAvail] = await Promise.all([
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: challengerCaptainId,
          startAt: challengerStart,
          endAt: challengerEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 10,
          eloTolerance: 150,
          expiresAt: challengerStart,
          status: "OPEN",
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: challengerCaptainId,
          startAt: new Date(challengerStart.getTime() + 24 * 60 * 60 * 1000),
          endAt: new Date(challengerEnd.getTime() + 24 * 60 * 60 * 1000),
          format: "FIVE_A_SIDE",
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 10,
          eloTolerance: 150,
          expiresAt: new Date(challengerStart.getTime() + 24 * 60 * 60 * 1000),
          status: "OPEN",
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          startAt: opponentStart,
          endAt: opponentEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.7441,
          originLng: 3.0422,
          radiusKm: 15,
          eloTolerance: 200,
          expiresAt: opponentStart,
          status: "OPEN",
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          startAt: opponentStart,
          endAt: opponentEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.7441,
          originLng: 3.0422,
          radiusKm: 15,
          eloTolerance: 200,
          expiresAt: opponentStart,
          status: "CANCELLED",
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: noCaptainTeamId,
          createdById: opponentCaptainId,
          startAt: opponentStart,
          endAt: opponentEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.7441,
          originLng: 3.0422,
          radiusKm: 15,
          eloTolerance: 200,
          expiresAt: opponentStart,
          status: "OPEN",
        },
      }),
    ]);
    challengerAvailabilityId = cAvail.id;
    challengerAvailability2Id = cAvail2.id;
    opponentAvailabilityId = oAvail.id;
    cancelledAvailabilityId = canAvail.id;
    noCaptainAvailabilityId = ncAvail.id;
  });

  afterAll(async () => {
    // Clean up created records in reverse dependency order
    await prisma.matchChallenge.deleteMany({
      where: {
        OR: [
          { challengerTeamId: { in: [challengerTeamId, opponentTeamId, noCaptainTeamId] } },
          { opponentTeamId: { in: [challengerTeamId, opponentTeamId, noCaptainTeamId] } },
        ],
      },
    });

    await prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: { in: [challengerCaptainId, opponentCaptainId, nonCaptainUserId] },
      },
    });

    await prisma.teamAvailability.deleteMany({
      where: {
        teamId: { in: [challengerTeamId, opponentTeamId, noCaptainTeamId] },
      },
    });

    await prisma.teamMembership.deleteMany({
      where: {
        teamId: { in: [challengerTeamId, opponentTeamId, noCaptainTeamId] },
      },
    });

    await prisma.team.deleteMany({
      where: {
        id: { in: [challengerTeamId, opponentTeamId, noCaptainTeamId] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [challengerCaptainId, opponentCaptainId, nonCaptainUserId] },
      },
    });

    await prisma.$disconnect();
  });

  it("successfully creates a challenge with canonical overlap snapshot and locked responseDeadline without modifying availability rows", async () => {
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId,
      message: "Ready for a great match!",
    };

    const challenge = await createChallenge(challengerCaptainId, input, baseNow);
    createdChallengeIds.push(challenge.id);

    expect(challenge.id).toBeDefined();
    expect(challenge.status).toBe("PENDING");
    expect(challenge.format).toBe("FIVE_A_SIDE");
    expect(challenge.challengerTeamId).toBe(challengerTeamId);
    expect(challenge.opponentTeamId).toBe(opponentTeamId);
    expect(challenge.challengerAvailabilityId).toBe(challengerAvailabilityId);
    expect(challenge.opponentAvailabilityId).toBe(opponentAvailabilityId);
    expect(challenge.organizerUserId).toBe(challengerCaptainId);
    expect(challenge.message).toBe("Ready for a great match!");
    expect(challenge.bookingDeadline).toBeNull();
    expect(challenge.respondedAt).toBeNull();
    expect(challenge.cancelledAt).toBeNull();

    // Canonical overlap snapshot:
    // startAt = max(challengerStart 18:00, opponentStart 18:30) = 18:30
    expect(challenge.startAt).toBe("2026-10-11T18:30:00.000Z");
    // endAt = min(challengerEnd 20:00, opponentEnd 20:30) = 20:00
    expect(challenge.endAt).toBe("2026-10-11T20:00:00.000Z");
    // radiusKm = min(10, 15) = 10
    expect(challenge.radiusKm).toBe(10);

    // Response deadline calculation:
    // min(baseNow + 24h = Oct 11 10:00, overlapStart - 4h = Oct 11 14:30) = Oct 11 10:00
    const expectedResponseDeadline = calculateChallengeResponseDeadline(
      baseNow,
      new Date(challenge.startAt),
    );
    expect(challenge.responseDeadline).toBe(expectedResponseDeadline.toISOString());

    // CRITICAL: Availability rows MUST NOT be modified on send (remain OPEN)
    const [reloadedChallengerAvail, reloadedOpponentAvail] = await Promise.all([
      prisma.teamAvailability.findUniqueOrThrow({
        where: { id: challengerAvailabilityId },
      }),
      prisma.teamAvailability.findUniqueOrThrow({
        where: { id: opponentAvailabilityId },
      }),
    ]);
    expect(reloadedChallengerAvail.status).toBe("OPEN");
    expect(reloadedOpponentAvail.status).toBe("OPEN");
  });

  it("retrying with the same idempotency key returns the exact same challenge without creating duplicates", async () => {
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId,
      message: "Ready for a great match!",
    };

    const initialChallengesCount = await prisma.matchChallenge.count({
      where: { challengerAvailabilityId, opponentAvailabilityId },
    });
    expect(initialChallengesCount).toBe(1);

    // Retry call
    const retried = await createChallenge(challengerCaptainId, input, baseNow);

    expect(retried.id).toBe(createdChallengeIds[0]);
    expect(retried.status).toBe("PENDING");
    expect(retried.startAt).toBe("2026-10-11T18:30:00.000Z");

    const countAfterRetry = await prisma.matchChallenge.count({
      where: { challengerAvailabilityId, opponentAvailabilityId },
    });
    expect(countAfterRetry).toBe(1);
  });

  it("retrying with the same idempotency key but modified payload throws 409 CONFLICT", async () => {
    const differentMessageInput = {
      challengerAvailabilityId,
      opponentAvailabilityId,
      message: "Different message attempting to reuse key",
    };

    await expect(
      createChallenge(challengerCaptainId, differentMessageInput, baseNow),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects duplicate pending challenge with explicit key when one already exists (409 CONFLICT)", async () => {
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId,
      message: "Second attempt with custom key",
    };

    // Calling with a custom idempotencyKey bypassing the cached idempotency record
    await expect(
      createChallenge(
        challengerCaptainId,
        input,
        baseNow,
        undefined,
        "custom-unique-key-123",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects when actor is not the captain of the challenger team (403 FORBIDDEN)", async () => {
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId,
    };

    await expect(
      createChallenge(nonCaptainUserId, input, baseNow),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("rejects self-challenge (422 CONDITIONS_VIOLATION)", async () => {
    // 1. Same availability ID (caught by schema validation mapped to 422)
    const sameAvailInput = {
      challengerAvailabilityId,
      opponentAvailabilityId: challengerAvailabilityId,
    };

    await expect(
      createChallenge(challengerCaptainId, sameAvailInput, baseNow),
    ).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });

    // 2. Different availability IDs belonging to the same team (caught by service domain rule mapped to 422)
    const sameTeamInput = {
      challengerAvailabilityId,
      opponentAvailabilityId: challengerAvailability2Id,
    };

    await expect(
      createChallenge(challengerCaptainId, sameTeamInput, baseNow),
    ).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
  });

  it("rejects when an availability is no longer OPEN (409 CONFLICT)", async () => {
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId: cancelledAvailabilityId,
    };

    await expect(
      createChallenge(challengerCaptainId, input, baseNow),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects when opponent team has no active captain (422 CONDITIONS_VIOLATION)", async () => {
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId: noCaptainAvailabilityId,
    };

    await expect(
      createChallenge(challengerCaptainId, input, baseNow),
    ).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
  });

  it("rejects expired availability window (409 CONFLICT)", async () => {
    const futureNow = new Date("2026-10-12T00:00:00.000Z"); // After availability end & expiresAt
    const input = {
      challengerAvailabilityId,
      opponentAvailabilityId,
    };

    await expect(
      createChallenge(challengerCaptainId, input, futureNow),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});
