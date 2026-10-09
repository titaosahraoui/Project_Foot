import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/error-handler";
import { uniqueEmail } from "../../test/integration-helpers";
import * as pitchesService from "../pitches/pitches.service";
import * as bookingsService from "./bookings.service";
import * as bookingsRepo from "./bookings.repository";

describe("M08-T03: PostgreSQL Booking Collision Protection & Inventory Subtraction (Integration)", () => {
  const runId = randomUUID();
  const password = "password123";

  let pitchOwnerId = "";
  let organizer1Id = "";
  let organizer2Id = "";
  let opponent1CaptainId = "";
  let opponent2CaptainId = "";

  let team1Id = "";
  let team2Id = "";
  let team3Id = "";
  let team4Id = "";

  let pitchId = "";
  let challenge1Id = "";
  let challenge2Id = "";

  // Fixed test timeline on Thursday Oct 15, 2026
  // Algiers is UTC+1. 19:00 Algiers = 18:00 UTC.
  const slotStart = new Date("2026-10-15T18:00:00.000Z");
  const slotEnd = new Date("2026-10-15T19:30:00.000Z"); // 90 min
  const adjacentEnd = new Date("2026-10-15T21:00:00.000Z"); // next 90 min

  const deadline = new Date("2026-10-15T12:00:00.000Z");

  beforeAll(async () => {
    // 1. Create users
    const [pOwner, org1, org2, op1, op2] = await Promise.all([
      prisma.user.create({
        data: {
          email: uniqueEmail(`pOwner_${runId}`),
          passwordHash: password,
          displayName: "Pitch Owner",
          roles: ["PITCH_OWNER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`org1_${runId}`),
          passwordHash: password,
          displayName: "Organizer 1",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`org2_${runId}`),
          passwordHash: password,
          displayName: "Organizer 2",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`op1_${runId}`),
          passwordHash: password,
          displayName: "Opponent 1 Captain",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`op2_${runId}`),
          passwordHash: password,
          displayName: "Opponent 2 Captain",
          roles: ["PLAYER"],
        },
      }),
    ]);

    pitchOwnerId = pOwner.id;
    organizer1Id = org1.id;
    organizer2Id = org2.id;
    opponent1CaptainId = op1.id;
    opponent2CaptainId = op2.id;

    // 2. Create teams
    const [t1, t2, t3, t4] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challengers A ${runId}`,
          lat: 36.75,
          lng: 3.05,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponents A ${runId}`,
          lat: 36.75,
          lng: 3.05,
        },
      }),
      prisma.team.create({
        data: {
          name: `Challengers B ${runId}`,
          lat: 36.75,
          lng: 3.05,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponents B ${runId}`,
          lat: 36.75,
          lng: 3.05,
        },
      }),
    ]);

    team1Id = t1.id;
    team2Id = t2.id;
    team3Id = t3.id;
    team4Id = t4.id;

    // 3. Create captain memberships
    await Promise.all([
      prisma.teamMembership.create({
        data: { teamId: team1Id, userId: organizer1Id, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: team2Id, userId: opponent1CaptainId, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: team3Id, userId: organizer2Id, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: team4Id, userId: opponent2CaptainId, role: "CAPTAIN" },
      }),
    ]);

    // 4. Create pitch with availability rules covering Thursday (day 4) 07:00 - 23:00 local (06:00 - 22:00 UTC)
    const pitch = await prisma.pitch.create({
      data: {
        ownerId: pitchOwnerId,
        name: `Bernabeu Algiers ${runId}`,
        address: "123 Rue Didouche Mourad",
        city: "Algiers",
        lat: 36.75,
        lng: 3.05,
        surface: "ARTIFICIAL_TURF",
        size: "SEVEN_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        isActive: true,
        availabilityRules: {
          create: [
            {
              dayOfWeek: 4, // Thursday
              startMinute: 420, // 07:00 local (06:00 UTC)
              endMinute: 1380, // 23:00 local (22:00 UTC)
              timezone: "Africa/Algiers",
              isActive: true,
            },
          ],
        },
      },
    });
    pitchId = pitch.id;

    // 5. Create team availabilities and match challenges
    const [avail1, avail2, avail3, avail4] = await Promise.all([
      prisma.teamAvailability.create({
        data: {
          teamId: team1Id,
          createdById: organizer1Id,
          startAt: new Date("2026-10-15T18:00:00.000Z"),
          endAt: new Date("2026-10-15T22:00:00.000Z"),
          format: "SEVEN_A_SIDE",
          originLat: 36.75,
          originLng: 3.05,
          radiusKm: 15,
          expiresAt: new Date("2026-10-15T17:00:00.000Z"),
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: team2Id,
          createdById: opponent1CaptainId,
          startAt: new Date("2026-10-15T18:00:00.000Z"),
          endAt: new Date("2026-10-15T22:00:00.000Z"),
          format: "SEVEN_A_SIDE",
          originLat: 36.75,
          originLng: 3.05,
          radiusKm: 15,
          expiresAt: new Date("2026-10-15T17:00:00.000Z"),
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: team3Id,
          createdById: organizer2Id,
          startAt: new Date("2026-10-15T18:00:00.000Z"),
          endAt: new Date("2026-10-15T22:00:00.000Z"),
          format: "SEVEN_A_SIDE",
          originLat: 36.75,
          originLng: 3.05,
          radiusKm: 15,
          expiresAt: new Date("2026-10-15T17:00:00.000Z"),
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: team4Id,
          createdById: opponent2CaptainId,
          startAt: new Date("2026-10-15T18:00:00.000Z"),
          endAt: new Date("2026-10-15T22:00:00.000Z"),
          format: "SEVEN_A_SIDE",
          originLat: 36.75,
          originLng: 3.05,
          radiusKm: 15,
          expiresAt: new Date("2026-10-15T17:00:00.000Z"),
        },
      }),
    ]);

    const [c1, c2] = await Promise.all([
      prisma.matchChallenge.create({
        data: {
          challengerAvailabilityId: avail1.id,
          opponentAvailabilityId: avail2.id,
          organizerUserId: organizer1Id,
          challengerTeamId: team1Id,
          opponentTeamId: team2Id,
          startAt: new Date("2026-10-15T18:00:00.000Z"),
          endAt: new Date("2026-10-15T22:00:00.000Z"),
          format: "SEVEN_A_SIDE",
          originLat: 36.75,
          originLng: 3.05,
          radiusKm: 15,
          status: "ACCEPTED",
          responseDeadline: new Date("2026-10-15T12:00:00.000Z"),
          bookingDeadline: new Date("2026-10-15T16:00:00.000Z"),
        },
      }),
      prisma.matchChallenge.create({
        data: {
          challengerAvailabilityId: avail3.id,
          opponentAvailabilityId: avail4.id,
          organizerUserId: organizer2Id,
          challengerTeamId: team3Id,
          opponentTeamId: team4Id,
          startAt: new Date("2026-10-15T18:00:00.000Z"),
          endAt: new Date("2026-10-15T22:00:00.000Z"),
          format: "SEVEN_A_SIDE",
          originLat: 36.75,
          originLng: 3.05,
          radiusKm: 15,
          status: "ACCEPTED",
          responseDeadline: new Date("2026-10-15T12:00:00.000Z"),
          bookingDeadline: new Date("2026-10-15T16:00:00.000Z"),
        },
      }),
    ]);

    challenge1Id = c1.id;
    challenge2Id = c2.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: { pitchId },
    });
    await prisma.matchChallenge.deleteMany({
      where: { id: { in: [challenge1Id, challenge2Id] } },
    });
    await prisma.teamAvailability.deleteMany({
      where: { teamId: { in: [team1Id, team2Id, team3Id, team4Id] } },
    });
    await prisma.pitchAvailabilityRule.deleteMany({
      where: { pitchId },
    });
    await prisma.pitch.deleteMany({
      where: { id: pitchId },
    });
    await prisma.teamMembership.deleteMany({
      where: { teamId: { in: [team1Id, team2Id, team3Id, team4Id] } },
    });
    await prisma.team.deleteMany({
      where: { id: { in: [team1Id, team2Id, team3Id, team4Id] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [pitchOwnerId, organizer1Id, organizer2Id, opponent1CaptainId, opponent2CaptainId] },
      },
    });
    await prisma.$disconnect();
  });

  it("fires two simultaneous requests for the same slot and proves one success, one conflict, and no duplicate blocking booking", async () => {
    // Both requests target the exact same pitch and exact same time window: 18:00 - 19:30
    const req1: bookingsRepo.CreateBookingData = {
      pitchId,
      challengeId: challenge1Id,
      organizerUserId: organizer1Id,
      challengerTeamId: team1Id,
      opponentTeamId: team2Id,
      startAt: slotStart,
      endAt: slotEnd,
      priceAmountMinor: 400000,
      currency: "DZD",
      ownerResponseDeadline: deadline,
      status: "PENDING_OWNER_CONFIRMATION",
    };

    const req2: bookingsRepo.CreateBookingData = {
      pitchId,
      challengeId: challenge2Id,
      organizerUserId: organizer2Id,
      challengerTeamId: team3Id,
      opponentTeamId: team4Id,
      startAt: slotStart,
      endAt: slotEnd,
      priceAmountMinor: 400000,
      currency: "DZD",
      ownerResponseDeadline: deadline,
      status: "PENDING_OWNER_CONFIRMATION",
    };

    // Fire concurrently
    const [res1, res2] = await Promise.allSettled([
      bookingsService.createBooking(req1),
      bookingsService.createBooking(req2),
    ]);

    const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejected = [res1, res2].filter((r) => r.status === "rejected");

    // Exactly one succeeds, exactly one conflicts
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(409);
    expect((error as HttpError).code).toBe("INVENTORY_CONFLICT");

    // Database check: exactly ONE blocking booking exists for this slot
    const blockingBookings = await prisma.booking.findMany({
      where: {
        pitchId,
        status: { in: ["PENDING_OWNER_CONFIRMATION", "CONFIRMED"] },
      },
    });
    expect(blockingBookings).toHaveLength(1);
    expect(blockingBookings[0]!.startAt.toISOString()).toBe(slotStart.toISOString());
    expect(blockingBookings[0]!.endAt.toISOString()).toBe(slotEnd.toISOString());
  });

  it("fails any positive overlap with an existing blocking booking (partial overlap)", async () => {
    // Overlapping slot: 19:00 - 20:30 overlaps with 18:00 - 19:30
    const overlappingStart = new Date("2026-10-15T19:00:00.000Z");
    const overlappingEnd = new Date("2026-10-15T20:30:00.000Z");

    const req: bookingsRepo.CreateBookingData = {
      pitchId,
      challengeId: challenge2Id,
      organizerUserId: organizer2Id,
      challengerTeamId: team3Id,
      opponentTeamId: team4Id,
      startAt: overlappingStart,
      endAt: overlappingEnd,
      priceAmountMinor: 400000,
      currency: "DZD",
      ownerResponseDeadline: deadline,
      status: "PENDING_OWNER_CONFIRMATION",
    };

    await expect(bookingsService.createBooking(req)).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof HttpError &&
        err.status === 409 &&
        err.code === "INVENTORY_CONFLICT"
      );
    });
  });

  it("permits adjacent bookings to coexist without collision due to half-open interval '[)'", async () => {
    // Adjacent slot: starts exactly at 19:30 when previous booking ends
    const adjacentStart = slotEnd; // 19:30
    const adjacentEndSlot = adjacentEnd; // 21:00

    const req: bookingsRepo.CreateBookingData = {
      pitchId,
      challengeId: challenge2Id,
      organizerUserId: organizer2Id,
      challengerTeamId: team3Id,
      opponentTeamId: team4Id,
      startAt: adjacentStart,
      endAt: adjacentEndSlot,
      priceAmountMinor: 400000,
      currency: "DZD",
      ownerResponseDeadline: deadline,
      status: "PENDING_OWNER_CONFIRMATION",
    };

    // Must succeed without exclusion constraint collision!
    const adjacentBooking = await bookingsService.createBooking(req);
    expect(adjacentBooking.id).toBeDefined();
    expect(adjacentBooking.status).toBe("PENDING_OWNER_CONFIRMATION");

    // Both bookings now coexist in database
    const blockingBookings = await prisma.booking.findMany({
      where: {
        pitchId,
        status: { in: ["PENDING_OWNER_CONFIRMATION", "CONFIRMED"] },
      },
      orderBy: { startAt: "asc" },
    });

    expect(blockingBookings).toHaveLength(2);
    expect(blockingBookings[0]!.startAt.toISOString()).toBe(slotStart.toISOString());
    expect(blockingBookings[0]!.endAt.toISOString()).toBe(slotEnd.toISOString());
    expect(blockingBookings[1]!.startAt.toISOString()).toBe(adjacentStart.toISOString());
    expect(blockingBookings[1]!.endAt.toISOString()).toBe(adjacentEndSlot.toISOString());
  });

  it("subtracts blocking bookings from pitches inventory through bookings.service with single batched lookup", async () => {
    const spy = vi.spyOn(bookingsService, "getBlockingBookingRangesForPitch");

    const slots = await pitchesService.getAvailableSlots(pitchId, {
      from: "2026-10-15T17:00:00.000Z",
      to: "2026-10-15T22:00:00.000Z",
      durationMinutes: 90,
    });

    // Exactly one batch query was performed to fetch blocking ranges for the [from, to] inventory request
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      pitchId,
      new Date("2026-10-15T17:00:00.000Z"),
      new Date("2026-10-15T22:00:00.000Z"),
    );
    spy.mockRestore();

    // Verify neither 18:00 nor 19:30 is listed in available slots because both are blocked by bookings
    const slotTimes = slots.map((s) => s.startAt);
    expect(slotTimes).not.toContain(slotStart.toISOString());
    expect(slotTimes).not.toContain(slotEnd.toISOString());
  });

  it("restores availability after a booking is DECLINED or EXPIRED", async () => {
    // 1. Find the two active bookings
    const active = await prisma.booking.findMany({
      where: { pitchId, status: "PENDING_OWNER_CONFIRMATION" },
      orderBy: { startAt: "asc" },
    });
    expect(active).toHaveLength(2);

    const firstBooking = active[0]!;
    const secondBooking = active[1]!;

    // 2. Decline the first booking (18:00 - 19:30)
    await prisma.booking.update({
      where: { id: firstBooking.id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
      },
    });

    // 3. Expire the second booking (19:30 - 21:00)
    await prisma.booking.update({
      where: { id: secondBooking.id },
      data: {
        status: "EXPIRED",
        expiresAt: new Date(),
      },
    });

    // 4. Verify inventory is restored: both slots now appear as available!
    const slots = await pitchesService.getAvailableSlots(pitchId, {
      from: "2026-10-15T17:00:00.000Z",
      to: "2026-10-15T22:00:00.000Z",
      durationMinutes: 90,
    });

    const slotTimes = slots.map((s) => s.startAt);
    expect(slotTimes).toContain(slotStart.toISOString());
    expect(slotTimes).toContain(slotEnd.toISOString());

    // 5. Verify database allows a new booking for the exact same previously-blocked slot (18:00 - 19:30)
    const newBooking = await bookingsService.createBooking({
      pitchId,
      challengeId: challenge1Id,
      organizerUserId: organizer1Id,
      challengerTeamId: team1Id,
      opponentTeamId: team2Id,
      startAt: slotStart,
      endAt: slotEnd,
      priceAmountMinor: 400000,
      currency: "DZD",
      ownerResponseDeadline: deadline,
      status: "PENDING_OWNER_CONFIRMATION",
    });

    expect(newBooking.id).toBeDefined();
    expect(newBooking.status).toBe("PENDING_OWNER_CONFIRMATION");
    expect(newBooking.startAt).toBe(slotStart.toISOString());
  });
});
