/**
 * Integration tests for Booking confirmation and lifecycle (Milestone 08 - Task 06).
 *
 * Covers:
 * - confirmBooking(ownerId, bookingId, now)
 * - declineBooking(ownerId, bookingId, now, input)
 * - cancelBooking(actorId, bookingId, input, now)
 * - expireDueBookings(now)
 *
 * Verifies:
 * - Only owning PITCH_OWNER acts before response deadline.
 * - Confirmation transitions booking to CONFIRMED and schedules Match with participants in same transaction.
 * - Match scheduling failure rolls back booking confirmation.
 * - Decline releases inventory and leaves challenge ACCEPTED.
 * - Pre-confirmation: only organizer cancels.
 * - Post-confirmation: designated captain (challenger or opponent) or pitch owner cancels.
 * - Team cancellation within 6 hours classified as late (isLateCancellation = true).
 * - Match is CANCELLED upon booking cancellation.
 * - Cancellation idempotency by same actor, 409 conflict on different actor.
 * - expireDueBookings transitions pending bookings past deadline to EXPIRED and releases inventory.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "../../lib/prisma";
import * as bookingsService from "./bookings.service";
import * as matchesService from "../matches/matches.service";

describe("bookings confirmation & lifecycle (integration - M08-T06)", () => {
  const baseTime = new Date("2026-11-25T10:00:00.000Z");
  const slotStart = new Date("2026-11-25T18:00:00.000Z");
  const slotEnd = new Date("2026-11-25T19:30:00.000Z");

  let pitchOwnerId: string;
  let organizerId: string;
  let opponentCaptainId: string;
  let otherUserId: string;

  let pitchId: string;
  let challengerTeamId: string;
  let opponentTeamId: string;
  let challengeId: string;
  let challengerAvailId: string;
  let opponentAvailId: string;

  const createdBookingIds: string[] = [];

  beforeAll(async () => {
    // 1. Seed users
    const pitchOwner = await prisma.user.create({
      data: {
        email: `pitchowner_m08t06_${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "Owner M08T06",
        roles: ["PITCH_OWNER"],
      },
    });
    pitchOwnerId = pitchOwner.id;

    const organizer = await prisma.user.create({
      data: {
        email: `organizer_m08t06_${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "Organizer M08T06",
        roles: ["PLAYER"],
      },
    });
    organizerId = organizer.id;

    const oppCaptain = await prisma.user.create({
      data: {
        email: `oppcaptain_m08t06_${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "Opponent Captain M08T06",
        roles: ["PLAYER"],
      },
    });
    opponentCaptainId = oppCaptain.id;

    const otherUser = await prisma.user.create({
      data: {
        email: `other_m08t06_${Date.now()}@example.com`,
        passwordHash: "hash",
        displayName: "Unrelated User M08T06",
        roles: ["PLAYER"],
      },
    });
    otherUserId = otherUser.id;

    // 2. Seed Pitch
    const pitch = await prisma.pitch.create({
      data: {
        ownerId: pitchOwnerId,
        name: "Lifecycle Arena",
        address: "123 Test Street",
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
    pitchId = pitch.id;

    // Add availability rule (Wednesday is day 3, 10:00 to 22:00 = 600..1320)
    await prisma.pitchAvailabilityRule.create({
      data: {
        pitchId,
        dayOfWeek: 3,
        startMinute: 600,
        endMinute: 1320,
        timezone: "Africa/Algiers",
        isActive: true,
      },
    });

    // 3. Seed Teams
    const teamA = await prisma.team.create({
      data: {
        name: `Team Alpha M08T06 ${Date.now()}`,
      },
    });
    challengerTeamId = teamA.id;

    const teamB = await prisma.team.create({
      data: {
        name: `Team Beta M08T06 ${Date.now()}`,
      },
    });
    opponentTeamId = teamB.id;

    // Assign captains
    await prisma.teamMembership.create({
      data: {
        teamId: challengerTeamId,
        userId: organizerId,
        role: "CAPTAIN",
        status: "ACTIVE",
      },
    });

    await prisma.teamMembership.create({
      data: {
        teamId: opponentTeamId,
        userId: opponentCaptainId,
        role: "CAPTAIN",
        status: "ACTIVE",
      },
    });

    // 4. Seed Availabilities
    const cAvail = await prisma.teamAvailability.create({
      data: {
        teamId: challengerTeamId,
        createdById: organizerId,
        format: "FIVE_A_SIDE",
        originLat: 36.75,
        originLng: 3.05,
        radiusKm: 15,
        startAt: new Date("2026-11-25T14:00:00.000Z"),
        endAt: new Date("2026-11-25T21:00:00.000Z"),
        status: "MATCHED",
        expiresAt: new Date("2026-11-25T21:00:00.000Z"),
      },
    });
    challengerAvailId = cAvail.id;

    const oAvail = await prisma.teamAvailability.create({
      data: {
        teamId: opponentTeamId,
        createdById: opponentCaptainId,
        format: "FIVE_A_SIDE",
        originLat: 36.75,
        originLng: 3.05,
        radiusKm: 15,
        startAt: new Date("2026-11-25T14:00:00.000Z"),
        endAt: new Date("2026-11-25T21:00:00.000Z"),
        status: "MATCHED",
        expiresAt: new Date("2026-11-25T21:00:00.000Z"),
      },
    });
    opponentAvailId = oAvail.id;

    // 5. Seed accepted Challenge
    const challenge = await prisma.matchChallenge.create({
      data: {
        challengerTeamId,
        opponentTeamId,
        challengerAvailabilityId: challengerAvailId,
        opponentAvailabilityId: opponentAvailId,
        organizerUserId: organizerId,
        format: "FIVE_A_SIDE",
        originLat: 36.75,
        originLng: 3.05,
        radiusKm: 15,
        startAt: new Date("2026-11-25T14:00:00.000Z"),
        endAt: new Date("2026-11-25T21:00:00.000Z"),
        status: "ACCEPTED",
        responseDeadline: new Date("2026-11-25T12:00:00.000Z"),
        bookingDeadline: new Date("2026-11-25T17:00:00.000Z"),
      },
    });
    challengeId = challenge.id;
  });

  afterAll(async () => {
    try {
      if (challengerTeamId && opponentTeamId) {
        await prisma.matchParticipant.deleteMany({
          where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
        });
        await prisma.match.deleteMany({
          where: { homeTeamId: challengerTeamId },
        });
      }
      if (pitchId) {
        await prisma.booking.deleteMany({ where: { pitchId } });
        await prisma.pitchBlock.deleteMany({ where: { pitchId } });
        await prisma.pitchAvailabilityRule.deleteMany({ where: { pitchId } });
        await prisma.pitch.deleteMany({ where: { id: pitchId } });
      }
      if (challengeId) {
        await prisma.matchChallenge.deleteMany({ where: { id: challengeId } });
      }
      if (challengerAvailId || opponentAvailId) {
        await prisma.teamAvailability.deleteMany({
          where: { id: { in: [challengerAvailId, opponentAvailId].filter(Boolean) } },
        });
      }
      if (challengerTeamId || opponentTeamId) {
        await prisma.teamMembership.deleteMany({
          where: { teamId: { in: [challengerTeamId, opponentTeamId].filter(Boolean) } },
        });
        await prisma.team.deleteMany({
          where: { id: { in: [challengerTeamId, opponentTeamId].filter(Boolean) } },
        });
      }
      const userIds = [pitchOwnerId, organizerId, opponentCaptainId, otherUserId].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    if (challengerTeamId && opponentTeamId) {
      await prisma.matchParticipant.deleteMany({
        where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
      });
      await prisma.match.deleteMany({
        where: { homeTeamId: challengerTeamId },
      });
    }
    if (pitchId) {
      await prisma.booking.deleteMany({
        where: { pitchId },
      });
    }
  });

  // Helper to create test booking
  async function createTestBooking(overrides?: Partial<{
    startAt: Date;
    endAt: Date;
    status: any;
    ownerResponseDeadline: Date;
  }>) {
    const booking = await prisma.booking.create({
      data: {
        pitchId,
        challengeId,
        organizerUserId: organizerId,
        challengerTeamId,
        opponentTeamId,
        startAt: overrides?.startAt ?? slotStart,
        endAt: overrides?.endAt ?? slotEnd,
        priceAmountMinor: 400000,
        currency: "DZD",
        status: overrides?.status ?? "PENDING_OWNER_CONFIRMATION",
        paymentStatus: "UNPAID",
        ownerResponseDeadline:
          overrides?.ownerResponseDeadline ??
          new Date(baseTime.getTime() + 24 * 3600 * 1000), // 24h
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  describe("Ownership verification", () => {
    it("rejects confirmation by non-pitch-owner with 403 FORBIDDEN", async () => {
      const b = await createTestBooking();
      await expect(
        bookingsService.confirmBooking(organizerId, b.id, baseTime),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    });

    it("rejects decline by non-pitch-owner with 403 FORBIDDEN", async () => {
      const b = await createTestBooking();
      await expect(
        bookingsService.declineBooking(opponentCaptainId, b.id, baseTime),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    });

    it("rejects pre-confirmation cancellation by anyone other than organizer with 403 FORBIDDEN", async () => {
      const b = await createTestBooking();
      // Pitch owner cannot cancel before confirmation
      await expect(
        bookingsService.cancelBooking(pitchOwnerId, b.id, {}, baseTime),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
      // Opponent captain cannot cancel before confirmation
      await expect(
        bookingsService.cancelBooking(opponentCaptainId, b.id, {}, baseTime),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
      // Random third party cannot cancel
      await expect(
        bookingsService.cancelBooking(otherUserId, b.id, {}, baseTime),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    });

    it("rejects post-confirmation cancellation by unrelated user with 403 FORBIDDEN", async () => {
      const b = await createTestBooking({ status: "CONFIRMED" });
      await expect(
        bookingsService.cancelBooking(otherUserId, b.id, {}, baseTime),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    });
  });

  describe("Deadlines verification", () => {
    it("rejects confirmation after ownerResponseDeadline with 409 STATE_CONFLICT", async () => {
      const pastDeadline = new Date(baseTime.getTime() - 1000);
      const b = await createTestBooking({ ownerResponseDeadline: pastDeadline });
      await expect(
        bookingsService.confirmBooking(pitchOwnerId, b.id, baseTime),
      ).rejects.toMatchObject({
        status: 409,
        code: "STATE_CONFLICT",
      });
    });

    it("rejects decline after ownerResponseDeadline with 409 STATE_CONFLICT", async () => {
      const pastDeadline = new Date(baseTime.getTime() - 1000);
      const b = await createTestBooking({ ownerResponseDeadline: pastDeadline });
      await expect(
        bookingsService.declineBooking(pitchOwnerId, b.id, baseTime),
      ).rejects.toMatchObject({
        status: 409,
        code: "STATE_CONFLICT",
      });
    });

    it("rejects cancellation after match endAt with 409 STATE_CONFLICT", async () => {
      const b = await createTestBooking({ status: "CONFIRMED" });
      const afterMatchEnd = new Date(slotEnd.getTime() + 1000);
      await expect(
        bookingsService.cancelBooking(organizerId, b.id, {}, afterMatchEnd),
      ).rejects.toMatchObject({
        status: 409,
        code: "STATE_CONFLICT",
      });
    });
  });

  describe("Confirmation & match scheduling", () => {
    it("confirms booking and atomically schedules match with participants", async () => {
      const b = await createTestBooking();

      const confirmed = await bookingsService.confirmBooking(
        pitchOwnerId,
        b.id,
        baseTime,
      );

      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.confirmedAt).toBeDefined();

      // Check Match created in database
      const match = await prisma.match.findUnique({
        where: { bookingId: b.id },
        include: { participants: true },
      });
      expect(match).not.toBeNull();
      expect(match?.status).toBe("SCHEDULED");
      expect(match?.homeTeamId).toBe(challengerTeamId);
      expect(match?.awayTeamId).toBe(opponentTeamId);
      expect(match?.homeCaptainId).toBe(organizerId);
      expect(match?.awayCaptainId).toBe(opponentCaptainId);
      expect(match?.pitchOwnerId).toBe(pitchOwnerId);
      expect(match?.format).toBe("FIVE_A_SIDE");

      // Verify two participants (HOME, AWAY)
      expect(match?.participants).toHaveLength(2);
      expect(match?.participants.some((p) => p.role === "HOME" && p.captainId === organizerId)).toBe(true);
      expect(match?.participants.some((p) => p.role === "AWAY" && p.captainId === opponentCaptainId)).toBe(true);

      // Verify idempotent retry returns same confirmed booking
      const retry = await bookingsService.confirmBooking(
        pitchOwnerId,
        b.id,
        baseTime,
      );
      expect(retry.id).toBe(confirmed.id);
      expect(retry.status).toBe("CONFIRMED");

      // Verify exactly 1 match remains
      const matchCount = await prisma.match.count({ where: { bookingId: b.id } });
      expect(matchCount).toBe(1);
    });

    it("rolls back booking confirmation if match creation fails in transaction", async () => {
      const b = await createTestBooking();

      // Spy on scheduleFromConfirmedBooking and force an error
      const scheduleSpy = vi
        .spyOn(matchesService, "scheduleFromConfirmedBooking")
        .mockRejectedValueOnce(new Error("FAILED_TO_SCHEDULE_MATCH"));

      await expect(
        bookingsService.confirmBooking(pitchOwnerId, b.id, baseTime),
      ).rejects.toThrow("FAILED_TO_SCHEDULE_MATCH");

      scheduleSpy.mockRestore();

      // Verify booking status was rolled back to PENDING_OWNER_CONFIRMATION
      const bookingInDb = await prisma.booking.findUnique({ where: { id: b.id } });
      expect(bookingInDb?.status).toBe("PENDING_OWNER_CONFIRMATION");
      expect(bookingInDb?.confirmedAt).toBeNull();

      // Verify no match exists
      const matchInDb = await prisma.match.findUnique({ where: { bookingId: b.id } });
      expect(matchInDb).toBeNull();
    });

    it("rejects conflicting decisions (cannot decline confirmed booking, cannot confirm declined booking)", async () => {
      const bConfirmed = await createTestBooking();
      await bookingsService.confirmBooking(pitchOwnerId, bConfirmed.id, baseTime);

      // Attempting to decline a confirmed booking
      await expect(
        bookingsService.declineBooking(pitchOwnerId, bConfirmed.id, baseTime),
      ).rejects.toMatchObject({
        status: 409,
        code: "STATE_CONFLICT",
      });

      // Clear before creating second booking
      if (challengerTeamId && opponentTeamId) {
        await prisma.matchParticipant.deleteMany({
          where: { teamId: { in: [challengerTeamId, opponentTeamId] } },
        });
        await prisma.match.deleteMany({
          where: { homeTeamId: challengerTeamId },
        });
      }
      if (pitchId) {
        await prisma.booking.deleteMany({
          where: { pitchId },
        });
      }

      const bDeclined = await createTestBooking();
      await bookingsService.declineBooking(pitchOwnerId, bDeclined.id, baseTime);

      // Attempting to confirm a declined booking
      await expect(
        bookingsService.confirmBooking(pitchOwnerId, bDeclined.id, baseTime),
      ).rejects.toMatchObject({
        status: 409,
        code: "STATE_CONFLICT",
      });
    });
  });

  describe("Decline and inventory release", () => {
    it("declines booking, releases pitch inventory, and leaves challenge ACCEPTED", async () => {
      const b = await createTestBooking();

      const declined = await bookingsService.declineBooking(
        pitchOwnerId,
        b.id,
        baseTime,
        { reason: "Pitch maintenance scheduled" },
      );

      expect(declined.status).toBe("DECLINED");
      expect(declined.declinedAt).toBeDefined();

      // Verify challenge remains ACCEPTED
      const challengeInDb = await prisma.matchChallenge.findUnique({
        where: { id: challengeId },
      });
      expect(challengeInDb?.status).toBe("ACCEPTED");

      // Verify repeated decline is idempotent
      const retryDecline = await bookingsService.declineBooking(
        pitchOwnerId,
        b.id,
        baseTime,
      );
      expect(retryDecline.status).toBe("DECLINED");

      // Verify pitch inventory is released: another booking on the same pitch slot succeeds without collision
      const newBooking = await prisma.booking.create({
        data: {
          pitchId,
          challengeId,
          organizerUserId: organizerId,
          challengerTeamId,
          opponentTeamId,
          startAt: slotStart,
          endAt: slotEnd,
          priceAmountMinor: 400000,
          currency: "DZD",
          status: "PENDING_OWNER_CONFIRMATION",
          paymentStatus: "UNPAID",
          ownerResponseDeadline: new Date(baseTime.getTime() + 24 * 3600 * 1000),
        },
      });
      createdBookingIds.push(newBooking.id);
      expect(newBooking.id).toBeDefined();
    });
  });

  describe("Pre-confirmation cancellation", () => {
    it("allows organizer to cancel pending booking, recording challengerTeam as responsibleTeam and releasing inventory", async () => {
      const b = await createTestBooking();

      const cancelled = await bookingsService.cancelBooking(
        organizerId,
        b.id,
        { reason: "Team member injured during training" },
        baseTime,
      );

      expect(cancelled.status).toBe("CANCELLED_BY_TEAM");
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancelledByUserId).toBe(organizerId);
      expect(cancelled.responsibleTeamId).toBe(challengerTeamId);
      expect(cancelled.cancellationReason).toBe("Team member injured during training");

      // Check DB
      const inDb = await prisma.booking.findUnique({ where: { id: b.id } });
      expect(inDb?.status).toBe("CANCELLED_BY_TEAM");
      expect(inDb?.responsibleTeamId).toBe(challengerTeamId);

      // Verify repeated cancellation by same actor is idempotent
      const retryCancel = await bookingsService.cancelBooking(
        organizerId,
        b.id,
        { reason: "Team member injured during training" },
        baseTime,
      );
      expect(retryCancel.status).toBe("CANCELLED_BY_TEAM");
    });
  });

  describe("Post-confirmation cancellation & late classification", () => {
    it("allows challenger captain to cancel early (>= 6h before start) with isLateCancellation = false and cancels Match", async () => {
      const b = await createTestBooking();
      await bookingsService.confirmBooking(pitchOwnerId, b.id, baseTime);

      // 7 hours before match start (18:00 - 7h = 11:00 UTC)
      const earlyCancelTime = new Date("2026-11-25T11:00:00.000Z");

      const cancelled = await bookingsService.cancelBooking(
        organizerId,
        b.id,
        { reason: "Early travel issue" },
        earlyCancelTime,
      );

      expect(cancelled.status).toBe("CANCELLED_BY_TEAM");
      expect(cancelled.responsibleTeamId).toBe(challengerTeamId);
      expect(cancelled.isLateCancellation).toBe(false);

      // Verify Match was also marked CANCELLED
      const match = await prisma.match.findUnique({ where: { bookingId: b.id } });
      expect(match?.status).toBe("CANCELLED");
    });

    it("allows opponent captain to cancel late (< 6h before start) with isLateCancellation = true and cancels Match", async () => {
      const b = await createTestBooking();
      await bookingsService.confirmBooking(pitchOwnerId, b.id, baseTime);

      // 3 hours before match start (18:00 - 3h = 15:00 UTC)
      const lateCancelTime = new Date("2026-11-25T15:00:00.000Z");

      const cancelled = await bookingsService.cancelBooking(
        opponentCaptainId,
        b.id,
        { reason: "Late forfeit" },
        lateCancelTime,
      );

      expect(cancelled.status).toBe("CANCELLED_BY_TEAM");
      expect(cancelled.responsibleTeamId).toBe(opponentTeamId);
      expect(cancelled.isLateCancellation).toBe(true);

      // Verify Match was marked CANCELLED
      const match = await prisma.match.findUnique({ where: { bookingId: b.id } });
      expect(match?.status).toBe("CANCELLED");
    });

    it("allows pitch owner to cancel confirmed booking as owner, setting CANCELLED_BY_OWNER and cancelling Match", async () => {
      const b = await createTestBooking();
      await bookingsService.confirmBooking(pitchOwnerId, b.id, baseTime);

      const cancelTime = new Date("2026-11-25T14:00:00.000Z");
      const cancelled = await bookingsService.cancelBooking(
        pitchOwnerId,
        b.id,
        { reason: "Pitch flooded due to heavy rain" },
        cancelTime,
      );

      expect(cancelled.status).toBe("CANCELLED_BY_OWNER");
      expect(cancelled.responsibleTeamId).toBeNull();
      expect(cancelled.isLateCancellation).toBe(false);

      // Verify Match was marked CANCELLED
      const match = await prisma.match.findUnique({ where: { bookingId: b.id } });
      expect(match?.status).toBe("CANCELLED");
    });

    it("rejects cancellation by different actor when booking is already cancelled", async () => {
      const b = await createTestBooking();
      await bookingsService.confirmBooking(pitchOwnerId, b.id, baseTime);

      // Organizer cancels
      await bookingsService.cancelBooking(organizerId, b.id, {}, baseTime);

      // Opponent captain attempts to cancel after organizer cancelled
      await expect(
        bookingsService.cancelBooking(opponentCaptainId, b.id, {}, baseTime),
      ).rejects.toMatchObject({
        status: 409,
        code: "STATE_CONFLICT",
      });
    });
  });

  describe("Expiry of due bookings", () => {
    it("expires pending bookings past ownerResponseDeadline and releases inventory", async () => {
      const pastDeadline = new Date("2026-11-25T12:00:00.000Z");
      const b = await createTestBooking({ ownerResponseDeadline: pastDeadline });

      const evaluationTime = new Date("2026-11-25T12:00:01.000Z");
      const expiredCount = await bookingsService.expireDueBookings(evaluationTime);
      expect(expiredCount.count).toBeGreaterThanOrEqual(1);

      const inDb = await prisma.booking.findUnique({ where: { id: b.id } });
      expect(inDb?.status).toBe("EXPIRED");
      expect(inDb?.expiresAt).toBeDefined();

      // Pitch inventory is released: another booking succeeds on this slot
      const newBooking = await prisma.booking.create({
        data: {
          pitchId,
          challengeId,
          organizerUserId: organizerId,
          challengerTeamId,
          opponentTeamId,
          startAt: slotStart,
          endAt: slotEnd,
          priceAmountMinor: 400000,
          currency: "DZD",
          status: "PENDING_OWNER_CONFIRMATION",
          paymentStatus: "UNPAID",
          ownerResponseDeadline: new Date(baseTime.getTime() + 24 * 3600 * 1000),
        },
      });
      createdBookingIds.push(newBooking.id);
      expect(newBooking.id).toBeDefined();
    });
  });
});
