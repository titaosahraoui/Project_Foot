import { describe, expect, it } from "vitest";
import {
  BOOKING_MAX_DURATION_MINUTES,
  BOOKING_MIN_DURATION_MINUTES,
  bookingDecisionSchema,
  bookingDetailSchema,
  bookingSchema,
  calculateOwnerResponseDeadline,
  cancelBookingSchema,
  confirmBookingSchema,
  createBookingSchema,
  declineBookingSchema,
  isLateCancellation,
  listBookingsQuerySchema,
} from "./booking";

describe("booking shared contracts (Milestone 08)", () => {
  const validUUIDs = {
    bookingId: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
    pitchId: "01010101-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
    challengeId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
    organizerUserId: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
    challengerTeamId: "f1f1f1f1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
    opponentTeamId: "02020202-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
  };

  const startAt = new Date("2026-10-15T18:00:00.000Z").toISOString();
  const endAt = new Date("2026-10-15T19:30:00.000Z").toISOString();

  describe("calculateOwnerResponseDeadline", () => {
    it("selects 24 hours after requested when start is far in future", () => {
      const requestedAt = new Date("2026-10-10T10:00:00.000Z");
      const matchStart = new Date("2026-10-20T18:00:00.000Z");

      const deadline = calculateOwnerResponseDeadline(requestedAt, matchStart);
      expect(deadline.toISOString()).toBe("2026-10-11T10:00:00.000Z");
    });

    it("selects 2 hours before start when start is less than 26 hours away", () => {
      const requestedAt = new Date("2026-10-10T10:00:00.000Z");
      const matchStart = new Date("2026-10-11T08:00:00.000Z"); // 22h later

      const deadline = calculateOwnerResponseDeadline(requestedAt, matchStart);
      // matchStart - 2h = 2026-10-11T06:00:00.000Z
      expect(deadline.toISOString()).toBe("2026-10-11T06:00:00.000Z");
    });
  });

  describe("isLateCancellation", () => {
    const matchStart = new Date("2026-10-15T18:00:00.000Z");

    it("returns false if cancelled 6 hours or more before start", () => {
      const cancelledAt = new Date("2026-10-15T12:00:00.000Z"); // exactly 6h before
      expect(isLateCancellation(matchStart, cancelledAt)).toBe(false);

      const earlier = new Date("2026-10-15T10:00:00.000Z"); // 8h before
      expect(isLateCancellation(matchStart, earlier)).toBe(false);
    });

    it("returns true if cancelled strictly less than 6 hours before start", () => {
      const late = new Date("2026-10-15T12:00:01.000Z"); // 5h 59m 59s before
      expect(isLateCancellation(matchStart, late)).toBe(true);

      const veryLate = new Date("2026-10-15T17:00:00.000Z"); // 1h before
      expect(isLateCancellation(matchStart, veryLate)).toBe(true);
    });
  });

  describe("createBookingSchema", () => {
    it("validates valid input within 30-180 minute duration", () => {
      const input = {
        challengeId: validUUIDs.challengeId,
        pitchId: validUUIDs.pitchId,
        startAt,
        endAt,
      };
      const parsed = createBookingSchema.parse(input);
      expect(parsed.challengeId).toBe(validUUIDs.challengeId);
      expect(parsed.pitchId).toBe(validUUIDs.pitchId);
    });

    it("rejects when endAt is equal to or before startAt", () => {
      expect(() =>
        createBookingSchema.parse({
          challengeId: validUUIDs.challengeId,
          pitchId: validUUIDs.pitchId,
          startAt,
          endAt: startAt,
        }),
      ).toThrow(/endAt must be strictly after startAt/);
    });

    it("rejects duration less than 30 minutes", () => {
      const shortEnd = new Date(new Date(startAt).getTime() + 20 * 60 * 1000).toISOString();
      expect(() =>
        createBookingSchema.parse({
          challengeId: validUUIDs.challengeId,
          pitchId: validUUIDs.pitchId,
          startAt,
          endAt: shortEnd,
        }),
      ).toThrow(new RegExp(`between ${BOOKING_MIN_DURATION_MINUTES} and ${BOOKING_MAX_DURATION_MINUTES}`));
    });

    it("rejects duration greater than 180 minutes", () => {
      const longEnd = new Date(new Date(startAt).getTime() + 190 * 60 * 1000).toISOString();
      expect(() =>
        createBookingSchema.parse({
          challengeId: validUUIDs.challengeId,
          pitchId: validUUIDs.pitchId,
          startAt,
          endAt: longEnd,
        }),
      ).toThrow(new RegExp(`between ${BOOKING_MIN_DURATION_MINUTES} and ${BOOKING_MAX_DURATION_MINUTES}`));
    });
  });

  describe("decision and cancel schemas", () => {
    it("validates booking decision", () => {
      expect(bookingDecisionSchema.parse({ decision: "CONFIRM" })).toEqual({ decision: "CONFIRM" });
      expect(bookingDecisionSchema.parse({ decision: "DECLINE", reason: "Slot unavailable" })).toEqual({
        decision: "DECLINE",
        reason: "Slot unavailable",
      });
      expect(() => bookingDecisionSchema.parse({ decision: "MAYBE" })).toThrow();
    });

    it("validates confirmBookingSchema and declineBookingSchema", () => {
      expect(confirmBookingSchema.parse({})).toEqual({});
      expect(confirmBookingSchema.parse({ reason: "Looking forward to hosting" })).toEqual({
        reason: "Looking forward to hosting",
      });
      expect(declineBookingSchema.parse({ reason: "Pitch undergoing repair" })).toEqual({
        reason: "Pitch undergoing repair",
      });
    });

    it("validates cancelBookingSchema", () => {
      expect(cancelBookingSchema.parse({})).toEqual({});
      expect(
        cancelBookingSchema.parse({
          reason: "Weather conditions",
          responsibleTeamId: validUUIDs.challengerTeamId,
        }),
      ).toEqual({
        reason: "Weather conditions",
        responsibleTeamId: validUUIDs.challengerTeamId,
      });
    });
  });

  describe("listBookingsQuerySchema", () => {
    it("parses valid list query with pagination and filters", () => {
      const query = listBookingsQuerySchema.parse({
        role: "owner",
        status: "PENDING_OWNER_CONFIRMATION",
        page: "2",
        limit: "10",
      });
      expect(query.role).toBe("owner");
      expect(query.status).toBe("PENDING_OWNER_CONFIRMATION");
      expect(query.page).toBe(2);
      expect(query.limit).toBe(10);
    });
  });

  describe("bookingSchema & bookingDetailSchema", () => {
    const validBooking = {
      id: validUUIDs.bookingId,
      pitchId: validUUIDs.pitchId,
      challengeId: validUUIDs.challengeId,
      organizerUserId: validUUIDs.organizerUserId,
      challengerTeamId: validUUIDs.challengerTeamId,
      opponentTeamId: validUUIDs.opponentTeamId,
      startAt,
      endAt,
      priceAmountMinor: 500000,
      currency: "DZD" as const,
      status: "PENDING_OWNER_CONFIRMATION" as const,
      paymentStatus: "UNPAID" as const,
      ownerResponseDeadline: new Date("2026-10-11T10:00:00.000Z").toISOString(),
      confirmedAt: null,
      declinedAt: null,
      cancelledAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("validates standard booking DTO", () => {
      const parsed = bookingSchema.parse(validBooking);
      expect(parsed.id).toBe(validUUIDs.bookingId);
      expect(parsed.priceAmountMinor).toBe(500000);
      expect(parsed.currency).toBe("DZD");
      expect(parsed.status).toBe("PENDING_OWNER_CONFIRMATION");
      expect(parsed.paymentStatus).toBe("UNPAID");
    });

    it("validates cancelled booking DTO with cancellation metadata", () => {
      const cancelledBooking = {
        ...validBooking,
        status: "CANCELLED_BY_TEAM" as const,
        cancelledAt: new Date().toISOString(),
        cancelledByUserId: validUUIDs.organizerUserId,
        responsibleTeamId: validUUIDs.challengerTeamId,
        cancellationReason: "Sudden player injury",
        isLateCancellation: true,
      };
      const parsed = bookingSchema.parse(cancelledBooking);
      expect(parsed.status).toBe("CANCELLED_BY_TEAM");
      expect(parsed.cancelledByUserId).toBe(validUUIDs.organizerUserId);
      expect(parsed.responsibleTeamId).toBe(validUUIDs.challengerTeamId);
      expect(parsed.cancellationReason).toBe("Sudden player injury");
      expect(parsed.isLateCancellation).toBe(true);
    });

    it("validates bookingDetailSchema with expanded relations", () => {
      const detail = bookingDetailSchema.parse({
        ...validBooking,
        pitch: {
          id: validUUIDs.pitchId,
          name: "Stade du 5 Juillet Annex",
          address: "Chemin Doudou Mokhtar",
          city: "Algiers",
          surface: "ARTIFICIAL_TURF",
          size: "FIVE_A_SIDE",
          priceAmountMinor: 500000,
          currency: "DZD",
          photos: [],
        },
        challengerTeam: {
          id: validUUIDs.challengerTeamId,
          name: "Challenger FC",
          logoUrl: null,
        },
        opponentTeam: {
          id: validUUIDs.opponentTeamId,
          name: "Opponent FC",
          logoUrl: null,
        },
        organizerUser: {
          id: validUUIDs.organizerUserId,
          displayName: "Captain Organizer",
          email: "captain@test.com",
        },
        matchId: null,
        viewerPermissions: {
          canConfirm: true,
          canDecline: true,
          canCancel: false,
        },
      });

      expect(detail.pitch?.name).toBe("Stade du 5 Juillet Annex");
      expect(detail.viewerPermissions?.canConfirm).toBe(true);
    });
  });
});
