import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  calculateOwnerResponseDeadline,
  type CreateBookingInput,
} from "@footconnect/shared";
import { uniqueEmail } from "../../test/integration-helpers";
import * as service from "./bookings.service";

describe("createBooking (integration - M08-T04)", () => {
  const runId = randomUUID();
  const password = "password123";

  let pitchOwnerId = "";
  let organizerId = "";
  let memberId = "";
  let opponentCaptainId = "";

  let challengerTeamId = "";
  let opponentTeamId = "";

  let pitchId = "";
  let challengerAvailId = "";
  let opponentAvailId = "";
  let challengeId = "";

  // Base clock for tests: Thursday, Oct 22, 2026 at 10:00 UTC
  const baseNow = new Date("2026-10-22T10:00:00.000Z");
  const challengeBookingDeadline = new Date("2026-10-22T16:00:00.000Z"); // 6h ahead
  const matchWindowStart = new Date("2026-10-22T17:00:00.000Z");
  const matchWindowEnd = new Date("2026-10-22T21:00:00.000Z");

  // Valid slot: 18:00 to 19:30 UTC (90 minutes)
  const slotStart = new Date("2026-10-22T18:00:00.000Z");
  const slotEnd = new Date("2026-10-22T19:30:00.000Z");

  beforeAll(async () => {
    // 1. Create users: Pitch Owner, Organizer (Challenger Captain), Challenger Regular Member, Opponent Captain
    const [pOwner, orgUser, regMember, oCap] = await Promise.all([
      prisma.user.create({
        data: {
          email: uniqueEmail(`pOwner_${runId}`),
          passwordHash: password,
          displayName: "Pitch Owner M08",
          roles: ["PITCH_OWNER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`orgUser_${runId}`),
          passwordHash: password,
          displayName: "Organizer Captain M08",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`regMember_${runId}`),
          passwordHash: password,
          displayName: "Regular Member M08",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`oCap_${runId}`),
          passwordHash: password,
          displayName: "Opponent Captain M08",
          roles: ["PLAYER"],
        },
      }),
    ]);
    pitchOwnerId = pOwner.id;
    organizerId = orgUser.id;
    memberId = regMember.id;
    opponentCaptainId = oCap.id;

    // 2. Create Pitch (5-a-side, 4,000 DZD/h = 400,000 minor DZD)
    const pitch = await prisma.pitch.create({
      data: {
        ownerId: pitchOwnerId,
        name: `Arena Algiers ${runId}`,
        description: "Modern artificial turf pitch",
        address: "50 Rue Didouche Mourad",
        city: "Algiers",
        lat: 36.7538,
        lng: 3.0588,
        surface: "ARTIFICIAL_TURF",
        size: "FIVE_A_SIDE",
        priceAmountMinor: 400000,
        currency: "DZD",
        amenities: ["LIGHTING", "SHOWERS", "PARKING"],
      },
    });
    pitchId = pitch.id;

    // Add availability rules for Thursday (day 4) 07:00 - 24:00 local time
    await prisma.pitchAvailabilityRule.create({
      data: {
        pitchId,
        dayOfWeek: 4, // Thursday
        startMinute: 420, // 07:00
        endMinute: 1440, // 24:00
        timezone: "Africa/Algiers",
        isActive: true,
      },
    });

    // 3. Create Teams
    const [cTeam, oTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challenger Club ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponent Club ${runId}`,
          lat: 36.755,
          lng: 3.06,
        },
      }),
    ]);
    challengerTeamId = cTeam.id;
    opponentTeamId = oTeam.id;

    // 4. Team Memberships
    await Promise.all([
      prisma.teamMembership.create({
        data: {
          teamId: challengerTeamId,
          userId: organizerId,
          role: "CAPTAIN",
        },
      }),
      prisma.teamMembership.create({
        data: {
          teamId: challengerTeamId,
          userId: memberId,
          role: "MEMBER",
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

    // 5. Team Availabilities
    const [cAvail, oAvail] = await Promise.all([
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: organizerId,
          format: "FIVE_A_SIDE",
          startAt: matchWindowStart,
          endAt: matchWindowEnd,
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: matchWindowEnd,
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          format: "FIVE_A_SIDE",
          startAt: matchWindowStart,
          endAt: matchWindowEnd,
          originLat: 36.755,
          originLng: 3.06,
          radiusKm: 15,
          status: "MATCHED",
          expiresAt: matchWindowEnd,
        },
      }),
    ]);
    challengerAvailId = cAvail.id;
    opponentAvailId = oAvail.id;

    // 6. Accepted Match Challenge
    const challenge = await prisma.matchChallenge.create({
      data: {
        challengerAvailabilityId: challengerAvailId,
        opponentAvailabilityId: opponentAvailId,
        challengerTeamId,
        opponentTeamId,
        organizerUserId: organizerId,
        format: "FIVE_A_SIDE",
        startAt: matchWindowStart,
        endAt: matchWindowEnd,
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 15,
        responseDeadline: new Date(baseNow.getTime() + 2 * 3600000),
        bookingDeadline: challengeBookingDeadline,
        status: "ACCEPTED",
      },
    });
    challengeId = challenge.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.idempotencyRecord.deleteMany({
      where: {
        actorId: { in: [organizerId, memberId, opponentCaptainId] },
      },
    });
    await prisma.booking.deleteMany({
      where: {
        challengeId,
      },
    });
    await prisma.matchChallenge.deleteMany({
      where: {
        id: challengeId,
      },
    });
    await prisma.teamAvailability.deleteMany({
      where: {
        id: { in: [challengerAvailId, opponentAvailId] },
      },
    });
    await prisma.teamMembership.deleteMany({
      where: {
        teamId: { in: [challengerTeamId, opponentTeamId] },
      },
    });
    await prisma.pitchAvailabilityRule.deleteMany({
      where: { pitchId },
    });
    await prisma.pitch.deleteMany({
      where: { id: pitchId },
    });
    await prisma.team.deleteMany({
      where: {
        id: { in: [challengerTeamId, opponentTeamId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [pitchOwnerId, organizerId, memberId, opponentCaptainId] },
      },
    });
    await prisma.$disconnect();
  });

  it("creates a PENDING_OWNER_CONFIRMATION booking when organizer requests compatible slot", async () => {
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };
    const key = `key-organizer-happy-${runId}`;

    const booking = await service.createBooking(organizerId, input, key, baseNow);

    expect(booking).toBeDefined();
    expect(booking.id).toBeDefined();
    expect(booking.pitchId).toBe(pitchId);
    expect(booking.challengeId).toBe(challengeId);
    expect(booking.organizerUserId).toBe(organizerId);
    expect(booking.challengerTeamId).toBe(challengerTeamId);
    expect(booking.opponentTeamId).toBe(opponentTeamId);
    expect(booking.status).toBe("PENDING_OWNER_CONFIRMATION");
    expect(booking.paymentStatus).toBe("UNPAID");

    // 90 minutes at 4,000 DZD/h = 600,000 minor DZD
    expect(booking.priceAmountMinor).toBe(600000);
    expect(booking.currency).toBe("DZD");

    // Owner response deadline: earlier of baseNow + 24h or slotStart - 2h
    const expectedOwnerDeadline = calculateOwnerResponseDeadline(baseNow, slotStart);
    expect(new Date(booking.ownerResponseDeadline).getTime()).toBe(
      expectedOwnerDeadline.getTime(),
    );

    // Verify persisted in PostgreSQL
    const inDb = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(inDb).not.toBeNull();
    expect(inDb!.status).toBe("PENDING_OWNER_CONFIRMATION");
    expect(inDb!.priceAmountMinor).toBe(600000);
  });

  it("returns the exact same booking on retry with same actor, scope, key and payload without duplicating DB row", async () => {
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };
    const key = `key-organizer-happy-${runId}`;

    // Retry call
    const retried = await service.createBooking(organizerId, input, key, baseNow);

    expect(retried.status).toBe("PENDING_OWNER_CONFIRMATION");
    expect(retried.priceAmountMinor).toBe(600000);

    // Proves DB count for this challenge is still exactly 1
    const count = await prisma.booking.count({
      where: { challengeId },
    });
    expect(count).toBe(1);
  });

  it("rejects with 409 CONFLICT when same key is used with a changed request payload", async () => {
    const key = `key-organizer-happy-${runId}`;
    // Changed payload: different start/end
    const changedInput: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: new Date("2026-10-22T19:30:00.000Z").toISOString(),
      endAt: new Date("2026-10-22T20:30:00.000Z").toISOString(),
    };

    await expect(
      service.createBooking(organizerId, changedInput, key, baseNow),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "CONFLICT",
        message: expect.stringContaining("Idempotency key was already used for a different request"),
      }),
    );
  });

  it("rejects with 422 CONDITIONS_VIOLATION when non-organizer member tries to create booking", async () => {
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };
    const key = `key-member-${runId}`;

    await expect(
      service.createBooking(memberId, input, key, baseNow),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 422,
        code: "CONDITIONS_VIOLATION",
        message: expect.stringContaining("not the agreed challenge organizer"),
      }),
    );
  });

  it("rejects with 422 CONDITIONS_VIOLATION when opponent captain tries to create booking", async () => {
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };
    const key = `key-opp-captain-${runId}`;

    await expect(
      service.createBooking(opponentCaptainId, input, key, baseNow),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 422,
        code: "CONDITIONS_VIOLATION",
        message: expect.stringContaining("not the agreed challenge organizer"),
      }),
    );
  });

  it("rejects with 409 STATE_CONFLICT when clock is past challenge booking deadline", async () => {
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };
    const key = `key-past-deadline-${runId}`;
    const pastDeadline = new Date(challengeBookingDeadline.getTime() + 1000);

    await expect(
      service.createBooking(organizerId, input, key, pastDeadline),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "STATE_CONFLICT",
      }),
    );

    // Restore challenge status to ACCEPTED for subsequent tests
    await prisma.matchChallenge.update({
      where: { id: challengeId },
      data: { status: "ACCEPTED" },
    });
  });

  it("verifies price snapshot: changing pitch hourlyRate does not mutate existing booking price", async () => {
    // 1. Fetch existing booking created earlier
    const existing = await prisma.booking.findFirst({
      where: { challengeId, status: "PENDING_OWNER_CONFIRMATION" },
    });
    expect(existing).not.toBeNull();
    expect(existing!.priceAmountMinor).toBe(600000);

    // 2. Owner updates pitch hourlyRate to 8,000 DZD (800,000 minor DZD)
    await prisma.pitch.update({
      where: { id: pitchId },
      data: { priceAmountMinor: 800000 },
    });

    // 3. Confirm existing booking retains snapshotted 600,000 minor DZD
    const refreshed = await prisma.booking.findUnique({
      where: { id: existing!.id },
    });
    expect(refreshed!.priceAmountMinor).toBe(600000);

    // Reset pitch price back
    await prisma.pitch.update({
      where: { id: pitchId },
      data: { priceAmountMinor: 400000 },
    });
  });

  it("permits a second booking attempt with a new key and new slot after previous attempt is declined", async () => {
    // 1. Owner declines the first booking
    const firstBooking = await prisma.booking.findFirst({
      where: { challengeId, status: "PENDING_OWNER_CONFIRMATION" },
    });
    expect(firstBooking).not.toBeNull();

    await prisma.booking.update({
      where: { id: firstBooking!.id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
      },
    });

    // 2. Organizer submits a new booking attempt with new key and new slot (19:30 to 21:00 UTC)
    const newSlotStart = new Date("2026-10-22T19:30:00.000Z");
    const newSlotEnd = new Date("2026-10-22T21:00:00.000Z");
    const newKey = `key-second-attempt-${runId}`;

    const newBooking = await service.createBooking(
      organizerId,
      {
        challengeId,
        pitchId,
        startAt: newSlotStart.toISOString(),
        endAt: newSlotEnd.toISOString(),
      },
      newKey,
      baseNow,
    );

    expect(newBooking).toBeDefined();
    expect(newBooking.id).not.toBe(firstBooking!.id);
    expect(newBooking.status).toBe("PENDING_OWNER_CONFIRMATION");
    expect(newBooking.startAt).toBe(newSlotStart.toISOString());
    expect(newBooking.endAt).toBe(newSlotEnd.toISOString());

    // Both bookings now exist in DB: one DECLINED, one PENDING_OWNER_CONFIRMATION
    const allBookings = await prisma.booking.findMany({
      where: { challengeId },
      orderBy: { createdAt: "asc" },
    });
    expect(allBookings.length).toBe(2);
    expect(allBookings[0]!.status).toBe("DECLINED");
    expect(allBookings[1]!.status).toBe("PENDING_OWNER_CONFIRMATION");

    // 3. While the new booking is still PENDING_OWNER_CONFIRMATION, a concurrent new attempt is rejected with 409 STATE_CONFLICT
    const thirdKey = `key-third-attempt-blocked-${runId}`;
    await expect(
      service.createBooking(
        organizerId,
        {
          challengeId,
          pitchId,
          startAt: new Date("2026-10-22T18:00:00.000Z").toISOString(),
          endAt: new Date("2026-10-22T19:00:00.000Z").toISOString(),
        },
        thirdKey,
        baseNow,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "STATE_CONFLICT",
      }),
    );
  });
  it("resolves concurrent requests with the exact same actor, key, and payload to the same booking (Issue 3)", async () => {
    // Decline previous booking so we have a clean slate
    await prisma.booking.updateMany({
      where: { challengeId, status: "PENDING_OWNER_CONFIRMATION" },
      data: { status: "DECLINED", declinedAt: new Date() },
    });

    const concurrentKey = `key-concurrent-idem-${runId}`;
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };

    const [res1, res2] = await Promise.all([
      service.createBooking(organizerId, input, concurrentKey, baseNow),
      service.createBooking(organizerId, input, concurrentKey, baseNow),
    ]);

    expect(res1.id).toBeDefined();
    expect(res2.id).toBeDefined();
    expect(res1.id).toBe(res2.id);
    expect(res1.status).toBe("PENDING_OWNER_CONFIRMATION");
  });

  it("enforces viewer permissions: unrelated user cannot view booking details (Issue 1)", async () => {
    const activeBooking = await prisma.booking.findFirst({
      where: { challengeId, status: "PENDING_OWNER_CONFIRMATION" },
    });
    expect(activeBooking).not.toBeNull();

    const stranger = await prisma.user.create({
      data: {
        email: uniqueEmail(`stranger_${runId}`),
        passwordHash: password,
        displayName: "Stranger User",
        roles: ["PLAYER"],
      },
    });

    // Unrelated user throws 403 FORBIDDEN
    await expect(
      service.getBookingById(activeBooking!.id, stranger.id),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 403,
        code: "FORBIDDEN",
      }),
    );

    // Unauthenticated access throws 403 FORBIDDEN
    await expect(
      service.getBookingById(activeBooking!.id, undefined),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 403,
        code: "FORBIDDEN",
      }),
    );

    // Organizer can view
    const organizerView = await service.getBookingById(activeBooking!.id, organizerId);
    expect(organizerView.id).toBe(activeBooking!.id);

    // Pitch owner can view
    const ownerView = await service.getBookingById(activeBooking!.id, pitchOwnerId);
    expect(ownerView.id).toBe(activeBooking!.id);

    // Team member can view
    const memberView = await service.getBookingById(activeBooking!.id, memberId);
    expect(memberView.id).toBe(activeBooking!.id);
  });

  it("enforces viewer permissions on listBookings: unscoped and role=captain queries return only viewer's bookings (Issue 1)", async () => {
    const stranger = await prisma.user.create({
      data: {
        email: uniqueEmail(`stranger2_${runId}`),
        passwordHash: password,
        displayName: "Stranger User 2",
        roles: ["PLAYER"],
      },
    });

    // Unrelated user with no role filter sees 0 bookings
    const unscopedResult = await service.listBookings({ page: 1, pageSize: 20 }, stranger.id);
    expect(unscopedResult.items.length).toBe(0);
    expect(unscopedResult.total).toBe(0);

    // Unrelated user with role=captain filter sees 0 bookings
    const captainResult = await service.listBookings({ page: 1, pageSize: 20, role: "captain" as any }, stranger.id);
    expect(captainResult.items.length).toBe(0);
    expect(captainResult.total).toBe(0);

    // Organizer sees their booking
    const organizerList = await service.listBookings({ page: 1, pageSize: 20 }, organizerId);
    expect(organizerList.items.some((b) => b.organizerUserId === organizerId)).toBe(true);

    // Pitch owner sees booking for their pitch
    const ownerList = await service.listBookings({ page: 1, pageSize: 20, role: "owner" }, pitchOwnerId);
    expect(ownerList.items.some((b) => b.pitch?.id === pitchId)).toBe(true);
  });
  it("rejects booking creation if challenge was cancelled or pitch block was added concurrently (Issue 2)", async () => {
    // 1. Decline prior booking to free challenge
    await prisma.booking.updateMany({
      where: { challengeId, status: "PENDING_OWNER_CONFIRMATION" },
      data: { status: "DECLINED", declinedAt: new Date() },
    });

    // 2. Add an active pitch block overlapping slot
    const block = await prisma.pitchBlock.create({
      data: {
        pitchId,
        createdById: pitchOwnerId,
        startAt: slotStart,
        endAt: slotEnd,
        reason: "Maintenance",
      },
    });

    const keyWithBlock = `key-blocked-${runId}`;
    const input: CreateBookingInput = {
      challengeId,
      pitchId,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
    };

    await expect(
      service.createBooking(organizerId, input, keyWithBlock, baseNow),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "INVENTORY_CONFLICT",
      }),
    );

    // Cancel the block
    await prisma.pitchBlock.update({
      where: { id: block.id },
      data: { cancelledAt: new Date() },
    });

    // 3. Mark challenge CANCELLED
    await prisma.matchChallenge.update({
      where: { id: challengeId },
      data: { status: "CANCELLED" },
    });

    const keyCancelled = `key-cancelled-${runId}`;
    await expect(
      service.createBooking(organizerId, input, keyCancelled, baseNow),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "STATE_CONFLICT",
      }),
    );

    // Restore challenge status to ACCEPTED
    await prisma.matchChallenge.update({
      where: { id: challengeId },
      data: { status: "ACCEPTED" },
    });
  });
});
