import { describe, expect, it } from "vitest";
import {
  BOOKING_DEFAULT_CURRENCY,
  BOOKING_MAX_DURATION_MINUTES,
  BOOKING_MIN_DURATION_MINUTES,
  BLOCKING_BOOKING_STATUSES,
  bookingDecisionSchema,
  bookingDetailSchema,
  bookingPriceSnapshotSchema,
  bookingSchema,
  bookingStatusSchema,
  calculateOwnerResponseDeadline,
  cancelBookingSchema,
  confirmBookingSchema,
  createBookingSchema,
  declineBookingSchema,
  isBlockingBookingStatus,
  listBookingsQuerySchema,
  offlinePaymentStatusSchema,
  type BookingStatus,
} from "./booking";

describe("booking contracts and schemas (shared)", () => {
  const validUUIDs = {
    bookingId: "a0000000-0000-0000-0000-000000000001",
    pitchId: "b0000000-0000-0000-0000-000000000002",
    challengeId: "c0000000-0000-0000-0000-000000000003",
    organizerUserId: "d0000000-0000-0000-0000-000000000004",
    challengerTeamId: "e0000000-0000-0000-0000-000000000005",
    opponentTeamId: "f0000000-0000-0000-0000-000000000006",
  };

  const startAt = new Date("2026-10-15T18:00:00.000Z").toISOString();
  const endAt = new Date("2026-10-15T19:30:00.000Z").toISOString(); // 90 min

  describe("enums and status helpers", () => {
    it("validates all booking status enum values", () => {
      const validStatuses: BookingStatus[] = [
        "PENDING_OWNER_CONFIRMATION",
        "CONFIRMED",
        "DECLINED",
        "CANCELLED_BY_TEAM",
        "CANCELLED_BY_OWNER",
        "EXPIRED",
      ];
      for (const status of validStatuses) {
        expect(bookingStatusSchema.parse(status)).toBe(status);
      }
      expect(() => bookingStatusSchema.parse("INVALID_STATUS")).toThrow();
    });

    it("validates offline payment statuses", () => {
      expect(offlinePaymentStatusSchema.parse("UNPAID")).toBe("UNPAID");
      expect(offlinePaymentStatusSchema.parse("PAID_AT_VENUE")).toBe("PAID_AT_VENUE");
      expect(offlinePaymentStatusSchema.parse("WAIVED")).toBe("WAIVED");
      expect(() => offlinePaymentStatusSchema.parse("CREDIT_CARD")).toThrow();
    });

    it("identifies blocking booking statuses correctly", () => {
      expect(BLOCKING_BOOKING_STATUSES).toEqual([
        "PENDING_OWNER_CONFIRMATION",
        "CONFIRMED",
      ]);
      expect(isBlockingBookingStatus("PENDING_OWNER_CONFIRMATION")).toBe(true);
      expect(isBlockingBookingStatus("CONFIRMED")).toBe(true);
      expect(isBlockingBookingStatus("DECLINED")).toBe(false);
      expect(isBlockingBookingStatus("CANCELLED_BY_TEAM")).toBe(false);
      expect(isBlockingBookingStatus("CANCELLED_BY_OWNER")).toBe(false);
      expect(isBlockingBookingStatus("EXPIRED")).toBe(false);
    });
  });

  describe("calculateOwnerResponseDeadline", () => {
    it("bounds owner deadline to 24h for matches far in the future (> 26h away)", () => {
      const requestedAt = new Date("2026-10-10T10:00:00.000Z");
      const matchStart = new Date("2026-10-15T18:00:00.000Z"); // 5+ days away

      const deadline = calculateOwnerResponseDeadline(requestedAt, matchStart);
      const expected = new Date("2026-10-11T10:00:00.000Z"); // requestedAt + 24h
      expect(deadline.toISOString()).toBe(expected.toISOString());
    });

    it("bounds owner deadline to 2h before match start for near matches (< 26h away)", () => {
      const requestedAt = new Date("2026-10-10T10:00:00.000Z");
      const matchStart = new Date("2026-10-10T18:00:00.000Z"); // 8h away

      const deadline = calculateOwnerResponseDeadline(requestedAt, matchStart);
      const expected = new Date("2026-10-10T16:00:00.000Z"); // matchStart - 2h
      expect(deadline.toISOString()).toBe(expected.toISOString());
    });
  });

  describe("bookingPriceSnapshotSchema", () => {
    it("validates price snapshot in DZD", () => {
      const snapshot = bookingPriceSnapshotSchema.parse({
        priceAmountMinor: 450000,
        currency: "DZD",
      });
      expect(snapshot.priceAmountMinor).toBe(450000);
      expect(snapshot.currency).toBe(BOOKING_DEFAULT_CURRENCY);
    });

    it("rejects negative amount or non-DZD currency", () => {
      expect(() =>
        bookingPriceSnapshotSchema.parse({ priceAmountMinor: -100, currency: "DZD" }),
      ).toThrow();
      expect(() =>
        bookingPriceSnapshotSchema.parse({ priceAmountMinor: 1000, currency: "EUR" }),
      ).toThrow();
    });
  });

  describe("createBookingSchema", () => {
    it("accepts valid create input with valid duration", () => {
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
