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

  let challengerTeamId = "";
  let opponentTeamId = "";
  let thirdTeamId = "";

  const baseNow = new Date("2026-10-10T10:00:00.000Z");
  const matchStart = new Date("2026-10-11T18:00:00.000Z"); // 32h after baseNow
  const matchEnd = new Date("2026-10-11T20:00:00.000Z");
  const responseDeadline = calculateChallengeResponseDeadline(baseNow, matchStart);

  beforeAll(async () => {
    // 1. Create users
    const [cCap, oCap, tCap, nonCap] = await Promise.all([
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
    ]);
    challengerCaptainId = cCap.id;
    opponentCaptainId = oCap.id;
    thirdCaptainId = tCap.id;
    nonCaptainUserId = nonCap.id;

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
        id: { in: [challengerCaptainId, opponentCaptainId, thirdCaptainId, nonCaptainUserId] },
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
        startAt: matchStart,
        endAt: matchEnd,
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        responseDeadline,
        bookingDeadline: overrides.bookingDeadline ?? null,
        status,
        message: "Match proposal",
        respondedAt: overrides.respondedAt ?? null,
        cancelledAt: overrides.cancelledAt ?? null,
        ...overrides,
      },
    });
  }

  describe("acceptChallenge", () => {
    it("atomically sets challenge to ACCEPTED, availability rows to MATCHED, computes bookingDeadline, and expires competing pending challenges", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);
      const tAvail = await createTestAvailability(thirdTeamId, thirdCaptainId);

      // Primary challenge between Challenger and Opponent
      const mainChallenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      // Competing challenge 1: references challenger availability (Third challenged Challenger)
      const competing1 = await createTestChallenge(
        thirdTeamId,
        challengerTeamId,
        tAvail.id,
        cAvail.id,
        thirdCaptainId,
      );

      // Competing challenge 2: references opponent availability (Opponent challenged Third)
      const competing2 = await createTestChallenge(
        opponentTeamId,
        thirdTeamId,
        oAvail.id,
        tAvail.id,
        opponentCaptainId,
      );

      // Unrelated challenge between two other availability windows (non-overlapping time slot)
      const unrelatedStart = new Date(matchStart.getTime() + 48 * 3600 * 1000);
      const unrelatedEnd = new Date(matchEnd.getTime() + 48 * 3600 * 1000);
      const unrelatedC = await createTestAvailability(
        thirdTeamId,
        thirdCaptainId,
        unrelatedStart,
        unrelatedEnd,
      );
      const unrelatedO = await createTestAvailability(
        challengerTeamId,
        challengerCaptainId,
        unrelatedStart,
        unrelatedEnd,
      );
      const unrelatedChallenge = await createTestChallenge(
        thirdTeamId,
        challengerTeamId,
        unrelatedC.id,
        unrelatedO.id,
        thirdCaptainId,
        "PENDING",
        {
          startAt: unrelatedStart,
          endAt: unrelatedEnd,
          responseDeadline: calculateChallengeResponseDeadline(baseNow, unrelatedStart),
        },
      );

      const acceptTime = new Date("2026-10-10T12:00:00.000Z");
      const accepted = await acceptChallenge(opponentCaptainId, mainChallenge.id, acceptTime);

      expect(accepted.status).toBe("ACCEPTED");
      expect(accepted.respondedAt).toBe(acceptTime.toISOString());
      const expectedBookingDeadline = calculateChallengeBookingDeadline(acceptTime, matchStart);
      expect(accepted.bookingDeadline).toBe(expectedBookingDeadline.toISOString());

      // Verify availability rows are MATCHED
      const [updatedCAvail, updatedOAvail, updatedTAvail] = await Promise.all([
        prisma.teamAvailability.findUnique({ where: { id: cAvail.id } }),
        prisma.teamAvailability.findUnique({ where: { id: oAvail.id } }),
        prisma.teamAvailability.findUnique({ where: { id: tAvail.id } }),
      ]);
      expect(updatedCAvail?.status).toBe("MATCHED");
      expect(updatedCAvail?.matchedAt?.toISOString()).toBe(acceptTime.toISOString());
      expect(updatedOAvail?.status).toBe("MATCHED");
      expect(updatedOAvail?.matchedAt?.toISOString()).toBe(acceptTime.toISOString());
      // Unrelated availability row is untouched
      expect(updatedTAvail?.status).toBe("OPEN");

      // Verify competing challenges are atomically EXPIRED
      const [comp1Db, comp2Db, unrelatedDb] = await Promise.all([
        prisma.matchChallenge.findUnique({ where: { id: competing1.id } }),
        prisma.matchChallenge.findUnique({ where: { id: competing2.id } }),
        prisma.matchChallenge.findUnique({ where: { id: unrelatedChallenge.id } }),
      ]);
      expect(comp1Db?.status).toBe("EXPIRED");
      expect(comp2Db?.status).toBe("EXPIRED");
      // Unrelated challenge is untouched
      expect(unrelatedDb?.status).toBe("PENDING");
    });

    it("returns 409 and leaves all rows unchanged if either availability was already matched", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      // Pre-match the challenger availability (e.g. by another accepted challenge)
      await prisma.teamAvailability.update({
        where: { id: cAvail.id },
        data: { status: "MATCHED", matchedAt: new Date() },
      });

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      await expect(
        acceptChallenge(opponentCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 409,
        }),
      );

      // Verify challenge remains PENDING
      const dbChallenge = await prisma.matchChallenge.findUnique({ where: { id: challenge.id } });
      expect(dbChallenge?.status).toBe("PENDING");

      // Verify opponent availability was left unchanged as OPEN
      const dbOAvail = await prisma.teamAvailability.findUnique({ where: { id: oAvail.id } });
      expect(dbOAvail?.status).toBe("OPEN");
    });

    it("repeating acceptChallenge returns current state without duplicate side effects", async () => {
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

      // Repeat with a later timestamp
      const laterTime = new Date("2026-10-10T15:00:00.000Z");
      const repeatResult = await acceptChallenge(opponentCaptainId, challenge.id, laterTime);

      expect(repeatResult.status).toBe("ACCEPTED");
      // Must retain original respondedAt and bookingDeadline
      expect(repeatResult.respondedAt).toBe(firstAcceptTime.toISOString());
      expect(repeatResult.bookingDeadline).toBe(firstResult.bookingDeadline);
    });

    it("rejects accept from non-opponent captain with 403", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      // Challenger captain cannot accept
      await expect(
        acceptChallenge(challengerCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));

      // Non-captain user cannot accept
      await expect(
        acceptChallenge(nonCaptainUserId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));
    });
  });

  describe("declineChallenge", () => {
    it("declines a pending challenge without modifying availability rows or other challenges", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      const declineTime = new Date("2026-10-10T12:00:00.000Z");
      const declined = await declineChallenge(opponentCaptainId, challenge.id, declineTime);

      expect(declined.status).toBe("DECLINED");
      expect(declined.respondedAt).toBe(declineTime.toISOString());

      // Availability rows must remain OPEN
      const [cDb, oDb] = await Promise.all([
        prisma.teamAvailability.findUnique({ where: { id: cAvail.id } }),
        prisma.teamAvailability.findUnique({ where: { id: oAvail.id } }),
      ]);
      expect(cDb?.status).toBe("OPEN");
      expect(oDb?.status).toBe("OPEN");

      // Repeat decline is idempotent
      const repeatDeclined = await declineChallenge(
        opponentCaptainId,
        challenge.id,
        new Date("2026-10-10T14:00:00.000Z"),
      );
      expect(repeatDeclined.status).toBe("DECLINED");
      expect(repeatDeclined.respondedAt).toBe(declineTime.toISOString());
    });

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
    });
  });

  describe("cancelChallenge", () => {
    it("organizer cancels PENDING challenge; leaves availability rows unchanged", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
      );

      const cancelTime = new Date("2026-10-10T13:00:00.000Z");
      const cancelled = await cancelChallenge(challengerCaptainId, challenge.id, cancelTime);

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelledAt).toBe(cancelTime.toISOString());

      // Availabilities remain OPEN
      const [cDb, oDb] = await Promise.all([
        prisma.teamAvailability.findUnique({ where: { id: cAvail.id } }),
        prisma.teamAvailability.findUnique({ where: { id: oAvail.id } }),
      ]);
      expect(cDb?.status).toBe("OPEN");
      expect(oDb?.status).toBe("OPEN");

      // Repeat cancel is idempotent
      const repeatCancelled = await cancelChallenge(
        challengerCaptainId,
        challenge.id,
        new Date("2026-10-10T15:00:00.000Z"),
      );
      expect(repeatCancelled.status).toBe("CANCELLED");
      expect(repeatCancelled.cancelledAt).toBe(cancelTime.toISOString());
    });

    it("organizer cancels ACCEPTED challenge before bookingDeadline; leaves availability rows unchanged", async () => {
      const cAvail = await createTestAvailability(challengerTeamId, challengerCaptainId);
      const oAvail = await createTestAvailability(opponentTeamId, opponentCaptainId);

      const acceptedTime = new Date("2026-10-10T11:00:00.000Z");
      const bookingDl = calculateChallengeBookingDeadline(acceptedTime, matchStart);

      const challenge = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail.id,
        oAvail.id,
        challengerCaptainId,
        "ACCEPTED",
        {
          respondedAt: acceptedTime,
          bookingDeadline: bookingDl,
        },
      );

      const cancelTime = new Date("2026-10-10T14:00:00.000Z");
      const cancelled = await cancelChallenge(challengerCaptainId, challenge.id, cancelTime);

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelledAt).toBe(cancelTime.toISOString());
      expect(cancelled.respondedAt).toBe(acceptedTime.toISOString());
    });

    it("rejects cancel from opponent captain with 403", async () => {
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
        cancelChallenge(opponentCaptainId, challenge.id, baseNow),
      ).rejects.toThrow(expect.objectContaining({ status: 403 }));
    });
  });

  describe("expireDueChallenges", () => {
    it("expires challenges whose responseDeadline or bookingDeadline has elapsed", async () => {
      const dayMs = 24 * 3600 * 1000;
      const slot1Start = new Date(matchStart.getTime() + 1 * dayMs);
      const slot1End = new Date(matchEnd.getTime() + 1 * dayMs);
      const slot2Start = new Date(matchStart.getTime() + 2 * dayMs);
      const slot2End = new Date(matchEnd.getTime() + 2 * dayMs);
      const slot3Start = new Date(matchStart.getTime() + 3 * dayMs);
      const slot3End = new Date(matchEnd.getTime() + 3 * dayMs);
      const slot4Start = new Date(matchStart.getTime() + 4 * dayMs);
      const slot4End = new Date(matchEnd.getTime() + 4 * dayMs);

      const [cAvail1, oAvail1, cAvail2, oAvail2, cAvail3, oAvail3, cAvail4, oAvail4] =
        await Promise.all([
          createTestAvailability(challengerTeamId, challengerCaptainId, slot1Start, slot1End),
          createTestAvailability(opponentTeamId, opponentCaptainId, slot1Start, slot1End),
          createTestAvailability(challengerTeamId, challengerCaptainId, slot2Start, slot2End),
          createTestAvailability(opponentTeamId, opponentCaptainId, slot2Start, slot2End),
          createTestAvailability(challengerTeamId, challengerCaptainId, slot3Start, slot3End),
          createTestAvailability(opponentTeamId, opponentCaptainId, slot3Start, slot3End),
          createTestAvailability(challengerTeamId, challengerCaptainId, slot4Start, slot4End),
          createTestAvailability(opponentTeamId, opponentCaptainId, slot4Start, slot4End),
        ]);

      const pastDeadline = new Date("2026-10-10T09:00:00.000Z");
      const futureDeadline = new Date("2026-10-10T18:00:00.000Z");

      // Due PENDING challenge
      const duePending = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail1.id,
        oAvail1.id,
        challengerCaptainId,
        "PENDING",
        {
          startAt: slot1Start,
          endAt: slot1End,
          responseDeadline: pastDeadline,
        },
      );

      // Future PENDING challenge
      const futurePending = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail2.id,
        oAvail2.id,
        challengerCaptainId,
        "PENDING",
        {
          startAt: slot2Start,
          endAt: slot2End,
          responseDeadline: futureDeadline,
        },
      );

      // Due ACCEPTED challenge
      const dueAccepted = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail3.id,
        oAvail3.id,
        challengerCaptainId,
        "ACCEPTED",
        {
          startAt: slot3Start,
          endAt: slot3End,
          bookingDeadline: pastDeadline,
        },
      );

      // Future ACCEPTED challenge
      const futureAccepted = await createTestChallenge(
        challengerTeamId,
        opponentTeamId,
        cAvail4.id,
        oAvail4.id,
        challengerCaptainId,
        "ACCEPTED",
        {
          startAt: slot4Start,
          endAt: slot4End,
          bookingDeadline: futureDeadline,
        },
      );

      const evalTime = new Date("2026-10-10T12:00:00.000Z");
      const expireResult = await expireDueChallenges(evalTime);

      expect(expireResult.count).toBeGreaterThanOrEqual(2);

      const [duePendingDb, futurePendingDb, dueAcceptedDb, futureAcceptedDb] = await Promise.all([
        prisma.matchChallenge.findUnique({ where: { id: duePending.id } }),
        prisma.matchChallenge.findUnique({ where: { id: futurePending.id } }),
        prisma.matchChallenge.findUnique({ where: { id: dueAccepted.id } }),
        prisma.matchChallenge.findUnique({ where: { id: futureAccepted.id } }),
      ]);

      expect(duePendingDb?.status).toBe("EXPIRED");
      expect(dueAcceptedDb?.status).toBe("EXPIRED");
      expect(futurePendingDb?.status).toBe("PENDING");
      expect(futureAcceptedDb?.status).toBe("ACCEPTED");
    });
  });
});
