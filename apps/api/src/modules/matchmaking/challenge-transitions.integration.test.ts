import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  calculateChallengeBookingDeadline,
  calculateChallengeResponseDeadline,
} from "@footconnect/shared";
import {
  acceptChallenge,
  cancelChallenge,
  declineChallenge,
  expireDueChallenges,
} from "./matchmaking.service";
import { uniqueEmail } from "../../test/integration-helpers";

describe("challenge transitions (integration)", () => {
  const runId = randomUUID();
  const password = "password123";

  let challengerCaptainId = "";
  let opponentCaptainId = "";
  let thirdCaptainId = "";
  let nonCaptainUserId = "";
  let unrelatedUserId = "";

  let challengerTeamId = "";
  let opponentTeamId = "";
  let thirdTeamId = "";

  const baseNow = new Date("2026-10-10T10:00:00.000Z");
  const matchStart = new Date("2026-10-11T18:00:00.000Z"); // 32h after baseNow
  const matchEnd = new Date("2026-10-11T20:00:00.000Z");
  const responseDeadline = calculateChallengeResponseDeadline(baseNow, matchStart);

  beforeAll(async () => {
    // 1. Create users
    const [cCap, oCap, tCap, nonCap, unrelated] = await Promise.all([
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
          email: uniqueEmail(`tCap_${runId}`),
          passwordHash: password,
          displayName: "Third Captain",
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`nonCap_${runId}`),
          passwordHash: password,
          displayName: "Non Captain",
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`unrelated_${runId}`),
          passwordHash: password,
          displayName: "Unrelated User",
        },
      }),
    ]);
    challengerCaptainId = cCap.id;
    opponentCaptainId = oCap.id;
    thirdCaptainId = tCap.id;
    nonCaptainUserId = nonCap.id;
    unrelatedUserId = unrelated.id;

    // 2. Create teams
    const [cTeam, oTeam, tTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challenger Team ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponent Team ${runId}`,
          lat: 36.7441,
          lng: 3.0422,
        },
      }),
      prisma.team.create({
        data: {
          name: `Third Team ${runId}`,
          lat: 36.75,
          lng: 3.05,
        },
      }),
    ]);
    challengerTeamId = cTeam.id;
    opponentTeamId = oTeam.id;
    thirdTeamId = tTeam.id;

    // 3. Memberships
    await Promise.all([
      prisma.teamMembership.create({
        data: { teamId: challengerTeamId, userId: challengerCaptainId, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: opponentTeamId, userId: opponentCaptainId, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: thirdTeamId, userId: thirdCaptainId, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: challengerTeamId, userId: nonCaptainUserId, role: "MEMBER" },
      }),
    ]);

    // 4. Team ratings
    await Promise.all([
      prisma.teamRating.create({ data: { teamId: challengerTeamId, rating: 1000 } }),
      prisma.teamRating.create({ data: { teamId: opponentTeamId, rating: 1000 } }),
      prisma.teamRating.create({ data: { teamId: thirdTeamId, rating: 1000 } }),
    ]);
  });

  beforeEach(async () => {
    const teamIds = [challengerTeamId, opponentTeamId, thirdTeamId];
    await prisma.matchChallenge.deleteMany({
      where: {
        OR: [{ challengerTeamId: { in: teamIds } }, { opponentTeamId: { in: teamIds } }],
      },
    });
    await prisma.teamAvailability.deleteMany({
      where: { teamId: { in: teamIds } },
    });
  });

  afterAll(async () => {
    // Clean up created records
    const teamIds = [challengerTeamId, opponentTeamId, thirdTeamId];
    await prisma.matchChallenge.deleteMany({
      where: {
        OR: [{ challengerTeamId: { in: teamIds } }, { opponentTeamId: { in: teamIds } }],
      },
    });
    await prisma.teamAvailability.deleteMany({
      where: { teamId: { in: teamIds } },
    });
    await prisma.teamRating.deleteMany({
      where: { teamId: { in: teamIds } },
    });
    await prisma.teamMembership.deleteMany({
      where: { teamId: { in: teamIds } },
    });
    await prisma.team.deleteMany({
      where: { id: { in: teamIds } },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [challengerCaptainId, opponentCaptainId, thirdCaptainId, nonCaptainUserId, unrelatedUserId] },
      },
    });
  });

  async function createTestAvailability(
    teamId: string,
    createdById: string,
    start: Date = matchStart,
    end: Date = matchEnd,
  ) {
    return prisma.teamAvailability.create({
      data: {
        teamId,
        createdById,
        startAt: start,
        endAt: end,
        format: "FIVE_A_SIDE",
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        eloTolerance: 150,
        expiresAt: start,
        status: "OPEN",
      },
    });
  }

  async function createTestChallenge(
    cTeamId: string,
    oTeamId: string,
    cAvailId: string,
    oAvailId: string,
    orgUserId: string,
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED" = "PENDING",
    overrides: Partial<any> = {},
  ) {
    return prisma.matchChallenge.create({
      data: {
        challengerTeamId: cTeamId,
        opponentTeamId: oTeamId,
        challengerAvailabilityId: cAvailId,
        opponentAvailabilityId: oAvailId,
        organizerUserId: orgUserId,
        format: "FIVE_A_SIDE",
        startAt: overrides.startAt ?? matchStart,
        endAt: overrides.endAt ?? matchEnd,
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        responseDeadline: overrides.responseDeadline ?? responseDeadline,
        bookingDeadline: overrides.bookingDeadline ?? null,
        status,
        message: "Match proposal",
        respondedAt: overrides.respondedAt ?? null,
        cancelledAt: overrides.cancelledAt ?? null,
        ...overrides,
      },
    });
  }

  describe("concurrent challenge races and mutual exclusion", () => {
    it("concurrently accepts two challenges sharing one availability and proves exactly one succeeds while the other fails with 409", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail1 = await createTestAvailability(opponentTeamId, opponentCaptainId);
      const oAvail2 = await createTestAvailability(thirdTeamId, thirdCaptainId);

      // Two challenges competing for cAvail
      const challenge1 = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail1.id,
        challengerCaptainId,
      );

      const challenge2 = await createTestChallenge(
        challengerTeamId,
        thirdTeamId,
        cAvail.id,
        oAvail2.id,
        challengerCaptainId,
      );

      const acceptTime = new Date("2026-10-10T12:00:00.000Z");

      // Concurrent execution of acceptChallenge on competing challenges sharing cAvail
      const results = await Promise.allSettled([
        acceptChallenge(opponentCaptainId, challenge1.id, acceptTime),
        acceptChallenge(thirdCaptainId, challenge2.id, acceptTime),
      ]);

      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled",
      );
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );

      // EXACTLY ONE SUCCEEDS, EXACTLY ONE FAILS
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const winning = fulfilled[0];
      const losing = rejected[0];
      expect(winning).toBeDefined();
      expect(losing).toBeDefined();
      if (!winning || !losing) {
        throw new Error("Expected one winning and one losing result");
      }

      expect(winning.value.status).toBe("ACCEPTED");
      expect(losing.reason).toBeDefined();
      expect(losing.reason.status).toBe(409);

      // Verify DB state
      const [dbChall1, dbChall2, dbCAvail, dbOAvail1, dbOAvail2] = await Promise.all([
        prisma.matchChallenge.findUnique({ where: { id: challenge1.id } }),
        prisma.matchChallenge.findUnique({ where: { id: challenge2.id } }),
        prisma.teamAvailability.findUnique({ where: { id: cAvail.id } }),
        prisma.teamAvailability.findUnique({ where: { id: oAvail1.id } }),
        prisma.teamAvailability.findUnique({ where: { id: oAvail2.id } }),
      ]);

      // Shared availability is MATCHED (never corrupted or duplicated)
      expect(dbCAvail?.status).toBe("MATCHED");

      if (winning.value.id === challenge1.id) {
        expect(dbChall1?.status).toBe("ACCEPTED");
        expect(dbOAvail1?.status).toBe("MATCHED");
        // Competing challenge was atomically expired, losing availability remains OPEN (rollback)
        expect(dbChall2?.status).toBe("EXPIRED");
        expect(dbOAvail2?.status).toBe("OPEN");
      } else {
        expect(dbChall2?.status).toBe("ACCEPTED");
        expect(dbOAvail2?.status).toBe("MATCHED");
        expect(dbChall1?.status).toBe("EXPIRED");
        expect(dbOAvail1?.status).toBe("OPEN");
      }
    });

    it("rolls back availability mutations if challenge acceptance fails", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      // Pre-cancel opponent availability to trigger transaction failure during accept
      await prisma.teamAvailability.update({
        where: { id: oAvail.id },
        data: { status: "CANCELLED" },
      });

      await expect(
        acceptChallenge(opponentCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 409 }));

      // Verify challenger availability was NOT marked MATCHED (clean rollback to OPEN)
      const dbCAvail = await prisma.teamAvailability.findUnique({ where: { id: cAvail.id } });
      expect(dbCAvail?.status).toBe("OPEN");
      expect(dbCAvail?.matchedAt).toBeNull();

      // Verify challenge remained PENDING
      const dbChallenge = await prisma.matchChallenge.findUnique({ where: { id: challenge.id } });
      expect(dbChallenge?.status).toBe("PENDING");
    });
  });

  describe("response deadline boundaries", () => {
    it("accepts challenge 1s before responseDeadline, but rejects at or after responseDeadline", async () => {
      const boundaryDeadline = new Date("2026-10-10T15:00:00.000Z");

      // 1. Success 1 second before deadline
      const cAvail1 = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail1 = await createTestAvailability(opponentTeamId, opponentCaptainId);
      const challenge1 = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail1.id,
        oAvail1.id,
        challengerCaptainId,
        "PENDING",
        { responseDeadline: boundaryDeadline },
      );

      const oneSecBefore = new Date(boundaryDeadline.getTime() - 1000);
      const accepted = await acceptChallenge(opponentCaptainId, challenge1.id, oneSecBefore);
      expect(accepted.status).toBe("ACCEPTED");

      // 2. Reject exactly at responseDeadline (use distinct future day slot to avoid Postgres open availability exclusion constraint)
      const slot2Start = new Date(matchStart.getTime() + 24 * 3600 * 1000);
      const slot2End = new Date(matchEnd.getTime() + 24 * 3600 * 1000);
      const cAvail2 = await createTestAvailability(challengerTeamId, challengerCaptainId, slot2Start, slot2End);
      const oAvail2 = await createTestAvailability(opponentTeamId, opponentCaptainId, slot2Start, slot2End);
      const challenge2 = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail2.id,
        oAvail2.id,
        challengerCaptainId,
        "PENDING",
        {
          startAt: slot2Start,
          endAt: slot2End,
          responseDeadline: boundaryDeadline,
        },
      );

      await expect(
        acceptChallenge(opponentCaptainId, challenge2.id, boundaryDeadline),
      ).rejects.toThrow(expect.objectContaining({ status: 409 }));

      // 3. Reject 1 second after responseDeadline
      const oneSecAfter = new Date(boundaryDeadline.getTime() + 1000);
      await expect(
        acceptChallenge(opponentCaptainId, challenge2.id, oneSecAfter),
      ).rejects.toThrow(expect.objectContaining({ status: 409 }));

      // 4. Reject at matchStart
      await expect(
        acceptChallenge(opponentCaptainId, challenge2.id, slot2Start),
      ).rejects.toThrow(expect.objectContaining({ status: 409 }));
    });
  });

  describe("organizer booking deadline calculation", () => {
    it("calculates bookingDeadline as 24h after acceptance for far matches (> 26h away)", async () => {
      const farStart = new Date("2026-10-20T18:00:00.000Z");
      const farEnd = new Date("2026-10-20T20:00:00.000Z");
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId, farStart, farEnd);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId, farStart, farEnd);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
        "PENDING",
        {
          startAt: farStart,
          endAt: farEnd,
          responseDeadline: calculateChallengeResponseDeadline(baseNow, farStart),
        },
      );

      const acceptedAt = new Date("2026-10-10T12:00:00.000Z");
      const result = await acceptChallenge(opponentCaptainId, challenge.id, acceptedAt);

      // Far match: booking deadline is exactly acceptedAt + 24 hours
      const expectedDeadline = new Date(acceptedAt.getTime() + 24 * 3600 * 1000);
      expect(result.bookingDeadline).toBe(expectedDeadline.toISOString());

      const dbChallenge = await prisma.matchChallenge.findUnique({ where: { id: challenge.id } });
      expect(dbChallenge?.bookingDeadline?.toISOString()).toBe(expectedDeadline.toISOString());
    });

    it("calculates bookingDeadline as 2h before match start for near matches (< 26h away)", async () => {
      const nearStart = new Date("2026-10-10T20:00:00.000Z"); // 8h after acceptedAt
      const nearEnd = new Date("2026-10-10T22:00:00.000Z");
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId, nearStart, nearEnd);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId, nearStart, nearEnd);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
        "PENDING",
        {
          startAt: nearStart,
          endAt: nearEnd,
          responseDeadline: calculateChallengeResponseDeadline(baseNow, nearStart),
        },
      );

      const acceptedAt = new Date("2026-10-10T12:00:00.000Z");
      const result = await acceptChallenge(opponentCaptainId, challenge.id, acceptedAt);

      // Near match (8h away): 2h before start is 18:00 (earlier than 24h)
      const expectedDeadline = new Date(nearStart.getTime() - 2 * 3600 * 1000);
      expect(result.bookingDeadline).toBe(expectedDeadline.toISOString());

      const dbChallenge = await prisma.matchChallenge.findUnique({ where: { id: challenge.id } });
      expect(dbChallenge?.bookingDeadline?.toISOString()).toBe(expectedDeadline.toISOString());
    });
  });

  describe("retry behavior and idempotency", () => {
    it("repeating acceptChallenge returns identical state without altering respondedAt or bookingDeadline", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      const firstAcceptTime = new Date("2026-10-10T12:00:00.000Z");
      const firstResult = await acceptChallenge(opponentCaptainId, challenge.id, firstAcceptTime);
      expect(firstResult.status).toBe("ACCEPTED");

      const laterTime = new Date("2026-10-10T15:00:00.000Z");
      const repeatResult = await acceptChallenge(opponentCaptainId, challenge.id, laterTime);

      expect(repeatResult.status).toBe("ACCEPTED");
      expect(repeatResult.respondedAt).toBe(firstAcceptTime.toISOString());
      expect(repeatResult.bookingDeadline).toBe(firstResult.bookingDeadline);
    });

    it("repeating declineChallenge returns identical state without altering respondedAt", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      const firstDeclineTime = new Date("2026-10-10T12:00:00.000Z");
      const firstResult = await declineChallenge(opponentCaptainId, challenge.id, firstDeclineTime);
      expect(firstResult.status).toBe("DECLINED");

      const laterTime = new Date("2026-10-10T15:00:00.000Z");
      const repeatResult = await declineChallenge(opponentCaptainId, challenge.id, laterTime);

      expect(repeatResult.status).toBe("DECLINED");
      expect(repeatResult.respondedAt).toBe(firstDeclineTime.toISOString());
    });

    it("repeating cancelChallenge returns identical state without altering cancelledAt", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      const firstCancelTime = new Date("2026-10-10T12:00:00.000Z");
      const firstResult = await cancelChallenge(challengerCaptainId, challenge.id, firstCancelTime);
      expect(firstResult.status).toBe("CANCELLED");

      const laterTime = new Date("2026-10-10T15:00:00.000Z");
      const repeatResult = await cancelChallenge(challengerCaptainId, challenge.id, laterTime);

      expect(repeatResult.status).toBe("CANCELLED");
      expect(repeatResult.cancelledAt).toBe(firstCancelTime.toISOString());
    });
  });

  describe("cancellation permissions", () => {
    it("allows organizer captain to cancel in PENDING and in ACCEPTED state before bookingDeadline", async () => {
      const cAvail1 = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail1 = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const pendingChallenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail1.id,
        oAvail1.id,
        challengerCaptainId,
      );

      const cancelTime = new Date("2026-10-10T13:00:00.000Z");
      const cancelledPending = await cancelChallenge(challengerCaptainId, pendingChallenge.id, cancelTime);
      expect(cancelledPending.status).toBe("CANCELLED");

      // ACCEPTED state before bookingDeadline on distinct day slot
      const slot2Start = new Date(matchStart.getTime() + 24 * 3600 * 1000);
      const slot2End = new Date(matchEnd.getTime() + 24 * 3600 * 1000);
      const cAvail2 = await createTestAvailability(challengerTeamId, challengerCaptainId, slot2Start, slot2End);
      const oAvail2 = await createTestAvailability(opponentTeamId, opponentCaptainId, slot2Start, slot2End);
      const acceptedTime = new Date("2026-10-10T11:00:00.000Z");
      const bookingDl = calculateChallengeBookingDeadline(acceptedTime, slot2Start);

      const acceptedChallenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail2.id,
        oAvail2.id,
        challengerCaptainId,
        "ACCEPTED",
        {
          startAt: slot2Start,
          endAt: slot2End,
          respondedAt: acceptedTime,
          bookingDeadline: bookingDl,
        },
      );

      const cancelledAccepted = await cancelChallenge(challengerCaptainId, acceptedChallenge.id, cancelTime);
      expect(cancelledAccepted.status).toBe("CANCELLED");
      expect(cancelledAccepted.cancelledAt).toBe(cancelTime.toISOString());
    });

    it("rejects cancel from opponent captain, team member, and unrelated user with 403", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      // Opponent captain cannot cancel
      await expect(
        cancelChallenge(opponentCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));

      // Non-captain squad member cannot cancel
      await expect(
        cancelChallenge(nonCaptainUserId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));

      // Unrelated user cannot cancel
      await expect(
        cancelChallenge(unrelatedUserId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));
    });

    it("rejects cancel on ACCEPTED challenge if bookingDeadline has passed with 409", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const pastBookingDl = new Date(baseNow.getTime() - 3600 * 1000);
      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
        "ACCEPTED",
        {
          bookingDeadline: pastBookingDl,
        },
      );

      await expect(
        cancelChallenge(challengerCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 409 }));
    });
  });

  describe("decline permissions", () => {
    it("rejects decline from non-opponent captain with 403", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      await expect(
        declineChallenge(challengerCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));

      await expect(
        declineChallenge(nonCaptainUserId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));
    });
  });

  describe("expireDueChallenges with fixed clock (no sleeps)", () => {
    it("evaluates exact responseDeadline and bookingDeadline boundaries using fixed clock", async () => {
      const fixedBoundary = new Date("2026-10-10T12:00:00.000Z");
      const dayMs = 24 * 3600 * 1000;
      const slot1Start = new Date(matchStart.getTime() + 1 * dayMs);
      const slot1End = new Date(matchEnd.getTime() + 1 * dayMs);
      const slot2Start = new Date(matchStart.getTime() + 2 * dayMs);
      const slot2End = new Date(matchEnd.getTime() + 2 * dayMs);

      const [cAvail1, oAvail1, cAvail2, oAvail2] = await Promise.all([
        createTestAvailability(challengerTeamId, challengerCaptainId, slot1Start, slot1End),
        createTestAvailability(opponentTeamId, opponentCaptainId, slot1Start, slot1End),
        createTestAvailability(challengerTeamId, challengerCaptainId, slot2Start, slot2End),
        createTestAvailability(opponentTeamId, opponentCaptainId, slot2Start, slot2End),
      ]);

      // 1. Pending challenge with exact responseDeadline
      const pendingChallenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail1.id,
        oAvail1.id,
        challengerCaptainId,
        "PENDING",
        {
          startAt: slot1Start,
          endAt: slot1End,
          responseDeadline: fixedBoundary,
        },
      );

      // 2. Accepted challenge with exact bookingDeadline
      const acceptedChallenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail2.id,
        oAvail2.id,
        challengerCaptainId,
        "ACCEPTED",
        {
          startAt: slot2Start,
          endAt: slot2End,
          bookingDeadline: fixedBoundary,
        },
      );

      // Fixed clock: 1ms before boundary -> neither should expire
      const beforeTime = new Date(fixedBoundary.getTime() - 1);
      await expireDueChallenges(beforeTime);

      const [pendingBefore, acceptedBefore] = await Promise.all([
        prisma.matchChallenge.findUnique({ where: { id: pendingChallenge.id } }),
        prisma.matchChallenge.findUnique({ where: { id: acceptedChallenge.id } }),
      ]);
      expect(pendingBefore?.status).toBe("PENDING");
      expect(acceptedBefore?.status).toBe("ACCEPTED");

      // Fixed clock: exactly at boundary -> BOTH must expire
      const expireResult = await expireDueChallenges(fixedBoundary);
      expect(expireResult.count).toBeGreaterThanOrEqual(2);

      const [pendingAt, acceptedAt] = await Promise.all([
        prisma.matchChallenge.findUnique({ where: { id: pendingChallenge.id } }),
        prisma.matchChallenge.findUnique({ where: { id: acceptedChallenge.id } }),
      ]);
      expect(pendingAt?.status).toBe("EXPIRED");
      expect(acceptedAt?.status).toBe("EXPIRED");
    });
  });
});
