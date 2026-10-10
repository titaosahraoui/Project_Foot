import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { withTransaction } from "../../lib/transaction";
import { uniqueEmail } from "../../test/integration-helpers";
import * as teamsService from "../teams/teams.service";
import * as matchesService from "./matches.service";

describe("matches.service (integration - M08-T05)", () => {
  const runId = randomUUID();
  const password = "password123";

  let pitchOwnerId = "";
  let homeCaptainId = "";
  let awayCaptainId = "";
  let newHomeCaptainId = "";

  let homeTeamId = "";
  let awayTeamId = "";

  let pitchId = "";
  let homeAvailId = "";
  let awayAvailId = "";
  let challengeId = "";
  let bookingId = "";

  const matchStart = new Date("2026-11-20T18:00:00.000Z");
  const matchEnd = new Date("2026-11-20T19:30:00.000Z");

  beforeAll(async () => {
    // 1. Create users sequentially to be kind to connection pooler
    const pOwner = await prisma.user.create({
      data: {
        email: uniqueEmail(`pOwner_${runId}`),
        passwordHash: password,
        displayName: "Pitch Owner User",
        roles: ["PITCH_OWNER"],
      },
    });
    const hCap = await prisma.user.create({
      data: {
        email: uniqueEmail(`hCap_${runId}`),
        passwordHash: password,
        displayName: "Home Captain User",
        roles: ["PLAYER"],
      },
    });
    const aCap = await prisma.user.create({
      data: {
        email: uniqueEmail(`aCap_${runId}`),
        passwordHash: password,
        displayName: "Away Captain User",
        roles: ["PLAYER"],
      },
    });
    const newHCap = await prisma.user.create({
      data: {
        email: uniqueEmail(`newHCap_${runId}`),
        passwordHash: password,
        displayName: "New Home Captain User",
        roles: ["PLAYER"],
      },
    });

    pitchOwnerId = pOwner.id;
    homeCaptainId = hCap.id;
    awayCaptainId = aCap.id;
    newHomeCaptainId = newHCap.id;

    // 2. Create teams
    const homeTeam = await prisma.team.create({
      data: {
        name: `Home Team ${runId}`,
        members: {
          create: [
            { userId: homeCaptainId, role: "CAPTAIN", status: "ACTIVE" },
            { userId: newHomeCaptainId, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    homeTeamId = homeTeam.id;

    const awayTeam = await prisma.team.create({
      data: {
        name: `Away Team ${runId}`,
        members: {
          create: [
            { userId: awayCaptainId, role: "CAPTAIN", status: "ACTIVE" },
          ],
        },
      },
    });
    awayTeamId = awayTeam.id;

    // 3. Create pitch
    const pitch = await prisma.pitch.create({
      data: {
        name: `Stadium ${runId}`,
        ownerId: pitchOwnerId,
        surface: "ARTIFICIAL_TURF",
        size: "FIVE_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        address: "123 Algiers Road",
        city: "Algiers",
        lat: 36.75,
        lng: 3.05,
      },
    });
    pitchId = pitch.id;

    // 4. Create availabilities
    const hAvail = await prisma.teamAvailability.create({
      data: {
        teamId: homeTeamId,
        createdById: homeCaptainId,
        startAt: matchStart,
        endAt: matchEnd,
        format: "FIVE_A_SIDE",
        originLat: 36.75,
        originLng: 3.05,
        radiusKm: 10,
        eloTolerance: 150,
        expiresAt: matchStart,
        status: "MATCHED",
      },
    });
    homeAvailId = hAvail.id;

    const aAvail = await prisma.teamAvailability.create({
      data: {
        teamId: awayTeamId,
        createdById: awayCaptainId,
        startAt: matchStart,
        endAt: matchEnd,
        format: "FIVE_A_SIDE",
        originLat: 36.75,
        originLng: 3.05,
        radiusKm: 10,
        eloTolerance: 150,
        expiresAt: matchStart,
        status: "MATCHED",
      },
    });
    awayAvailId = aAvail.id;

    // 5. Create challenge
    const challenge = await prisma.matchChallenge.create({
      data: {
        challengerTeamId: homeTeamId,
        opponentTeamId: awayTeamId,
        challengerAvailabilityId: homeAvailId,
        opponentAvailabilityId: awayAvailId,
        organizerUserId: homeCaptainId,
        format: "FIVE_A_SIDE",
        startAt: matchStart,
        endAt: matchEnd,
        originLat: 36.75,
        originLng: 3.05,
        radiusKm: 10,
        responseDeadline: new Date(Date.now() + 86400000),
        bookingDeadline: new Date(Date.now() + 86400000),
        status: "ACCEPTED",
      },
    });
    challengeId = challenge.id;

    // 6. Create booking
    const booking = await prisma.booking.create({
      data: {
        pitchId,
        challengeId,
        organizerUserId: homeCaptainId,
        challengerTeamId: homeTeamId,
        opponentTeamId: awayTeamId,
        startAt: matchStart,
        endAt: matchEnd,
        priceAmountMinor: 400000,
        currency: "DZD",
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        ownerResponseDeadline: new Date(Date.now() + 86400000),
        confirmedAt: new Date(),
      },
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    try {
      if (homeTeamId && awayTeamId) {
        await prisma.matchParticipant.deleteMany({
          where: { teamId: { in: [homeTeamId, awayTeamId] } },
        });
      }
      if (bookingId) {
        await prisma.match.deleteMany({
          where: { bookingId },
        });
        await prisma.booking.deleteMany({
          where: { id: bookingId },
        });
      }
      if (challengeId) {
        await prisma.matchChallenge.deleteMany({
          where: { id: challengeId },
        });
      }
      if (homeAvailId && awayAvailId) {
        await prisma.teamAvailability.deleteMany({
          where: { id: { in: [homeAvailId, awayAvailId] } },
        });
      }
      if (pitchId) {
        await prisma.pitch.deleteMany({
          where: { id: pitchId },
        });
      }
      if (homeTeamId && awayTeamId) {
        await prisma.teamMembership.deleteMany({
          where: { teamId: { in: [homeTeamId, awayTeamId] } },
        });
        await prisma.team.deleteMany({
          where: { id: { in: [homeTeamId, awayTeamId] } },
        });
      }
      const userIds = [pitchOwnerId, homeCaptainId, awayCaptainId, newHomeCaptainId].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("schedules one match and two participants from a confirmed booking", async () => {
    const scheduled = await matchesService.scheduleFromConfirmedBooking({
      bookingId,
      homeTeamId,
      awayTeamId,
      pitchOwnerId,
      startAt: matchStart,
      endAt: matchEnd,
      format: "FIVE_A_SIDE",
    });

    expect(scheduled.bookingId).toBe(bookingId);
    expect(scheduled.homeTeamId).toBe(homeTeamId);
    expect(scheduled.awayTeamId).toBe(awayTeamId);
    expect(scheduled.pitchOwnerId).toBe(pitchOwnerId);
    expect(scheduled.status).toBe("SCHEDULED");
    expect(scheduled.format).toBe("FIVE_A_SIDE");

    // Verify exactly one match in database
    const matchesInDb = await prisma.match.findMany({
      where: { bookingId },
    });
    expect(matchesInDb).toHaveLength(1);
    expect(matchesInDb[0]?.id).toBe(scheduled.id);

    // Verify exactly two participants in database
    const participantsInDb = await prisma.matchParticipant.findMany({
      where: { matchId: scheduled.id },
      orderBy: { role: "asc" },
    });
    expect(participantsInDb).toHaveLength(2);

    const awayParticipant = participantsInDb.find((p) => p.role === "AWAY");
    const homeParticipant = participantsInDb.find((p) => p.role === "HOME");

    expect(homeParticipant).toBeDefined();
    expect(awayParticipant).toBeDefined();

    expect(homeParticipant!.teamId).toBe(homeTeamId);
    expect(homeParticipant!.captainId).toBe(homeCaptainId);

    expect(awayParticipant!.teamId).toBe(awayTeamId);
    expect(awayParticipant!.captainId).toBe(awayCaptainId);
  });

  it("snapshots active captain IDs so subsequent team transfers do not alter the match snapshot", async () => {
    // Check initial match captains
    const initialMatch = await matchesService.getMatchByBookingId(bookingId);
    expect(initialMatch).not.toBeNull();
    expect(initialMatch?.homeCaptainId).toBe(homeCaptainId);
    expect(initialMatch?.awayCaptainId).toBe(awayCaptainId);

    // Transfer captaincy of home team to newHomeCaptainId
    await teamsService.transferCaptain(homeTeamId, homeCaptainId, {
      newCaptainUserId: newHomeCaptainId,
    });

    // Verify current team captain is indeed updated
    const currentActiveCaptain = await teamsService.getActiveCaptainId(homeTeamId);
    expect(currentActiveCaptain).toBe(newHomeCaptainId);

    // Verify match captain snapshot is IMMUTABLE and still points to original homeCaptainId
    const matchAfterTransfer = await matchesService.getMatchByBookingId(bookingId);
    expect(matchAfterTransfer?.homeCaptainId).toBe(homeCaptainId);

    // Verify match participants snapshot is also IMMUTABLE
    const homeParticipant = matchAfterTransfer?.participants?.find(
      (p) => p.role === "HOME",
    );
    expect(homeParticipant).toBeDefined();
    expect(homeParticipant!.captainId).toBe(homeCaptainId);
  });

  it("is idempotent by bookingId on retries and returns the existing match without duplicate DB rows", async () => {
    // Call scheduleFromConfirmedBooking again with the exact same bookingId
    const retryResult = await matchesService.scheduleFromConfirmedBooking({
      bookingId,
      homeTeamId,
      awayTeamId,
      pitchOwnerId,
      startAt: matchStart,
      endAt: matchEnd,
      format: "FIVE_A_SIDE",
    });

    // Should return existing match
    const existingMatch = await matchesService.getMatchByBookingId(bookingId);
    expect(retryResult.id).toBe(existingMatch?.id);
    expect(retryResult.bookingId).toBe(bookingId);
    expect(retryResult.homeCaptainId).toBe(homeCaptainId);

    // Prove DB still has exactly 1 match and 2 participants
    const matchesCount = await prisma.match.count({ where: { bookingId } });
    expect(matchesCount).toBe(1);

    const participantsCount = await prisma.matchParticipant.count({
      where: { matchId: retryResult.id },
    });
    expect(participantsCount).toBe(2);
  });

  it("rolls back match creation when shared transaction fails", async () => {
    const tempBooking = await prisma.booking.create({
      data: {
        pitchId,
        challengeId,
        organizerUserId: homeCaptainId,
        challengerTeamId: homeTeamId,
        opponentTeamId: awayTeamId,
        startAt: new Date("2026-11-21T18:00:00.000Z"),
        endAt: new Date("2026-11-21T19:30:00.000Z"),
        priceAmountMinor: 400000,
        currency: "DZD",
        status: "DECLINED",
        paymentStatus: "UNPAID",
        ownerResponseDeadline: new Date(Date.now() + 86400000),
        declinedAt: new Date(),
      },
    });

    await expect(
      withTransaction(async (tx) => {
        await matchesService.scheduleFromConfirmedBooking(
          {
            bookingId: tempBooking.id,
            homeTeamId,
            awayTeamId,
            pitchOwnerId,
            startAt: tempBooking.startAt,
            endAt: tempBooking.endAt,
            format: "FIVE_A_SIDE",
          },
          tx,
        );
        throw new Error("FORCED_TRANSACTION_ROLLBACK");
      }),
    ).rejects.toThrow("FORCED_TRANSACTION_ROLLBACK");

    const match = await matchesService.getMatchByBookingId(tempBooking.id);
    expect(match).toBeNull();

    await prisma.booking.delete({ where: { id: tempBooking.id } });
  });
});
