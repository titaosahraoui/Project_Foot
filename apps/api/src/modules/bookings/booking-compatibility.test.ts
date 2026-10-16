import { describe, expect, it } from "vitest";
import type {
  AvailableSlot,
  BlockingRange,
  PitchAvailabilityRule,
  PitchBlock,
} from "@footconnect/shared";
import {
  assertBookingCompatible,
  type AssertBookingCompatibleInput,
} from "./booking-compatibility";

describe("assertBookingCompatible (unit)", () => {
  const fixedNow = new Date("2026-10-10T12:00:00.000Z");
  const deadline = new Date("2026-10-10T18:00:00.000Z");

  const organizerUserId = "user-organizer-captain-1";
  const challengerTeamId = "team-challenger-1";

  // Challenge window: 2026-10-12 from 18:00 to 21:00 UTC (Monday in Algiers: 19:00 to 22:00 UTC+1)
  const challengeStart = new Date("2026-10-12T18:00:00.000Z");
  const challengeEnd = new Date("2026-10-12T21:00:00.000Z");

  // Algiers coordinates
  const originLat = 36.7538;
  const originLng = 3.0588;
  const radiusKm = 10;

  // Monday = dayOfWeek 1. 19:00 local = 1140 min.
  // startMinute: 420 (07:00 local). (1140 - 420) = 720 minutes.
  // 720 is divisible by 30, 60, 90, 120, 180, so all standard durations cleanly produce 18:00 UTC.
  const defaultAvailabilityRules: PitchAvailabilityRule[] = [
    {
      id: "rule-monday",
      pitchId: "pitch-1",
      dayOfWeek: 1, // Monday
      startMinute: 420, // 07:00
      endMinute: 1440, // 24:00
      startTime: "07:00",
      endTime: "24:00",
      timezone: "Africa/Algiers",
      isActive: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ];

  const defaultPitch = {
    id: "pitch-1",
    isActive: true,
    size: "FIVE_A_SIDE" as const,
    lat: 36.7538, // 0 km distance
    lng: 3.0588,
    priceAmountMinor: 400000, // 4,000.00 DZD / hour
    currency: "DZD",
    availabilityRules: defaultAvailabilityRules,
    blocks: [] as PitchBlock[],
  };

  const defaultChallenge = {
    status: "ACCEPTED" as const,
    bookingDeadline: deadline,
    organizerUserId,
    challengerTeamId,
    format: "FIVE_A_SIDE" as const,
    startAt: challengeStart,
    endAt: challengeEnd,
    originLat,
    originLng,
    radiusKm,
  };

  function createValidInput(
    overrides: Partial<AssertBookingCompatibleInput> = {},
  ): AssertBookingCompatibleInput {
    return {
      challenge: { ...defaultChallenge },
      actorId: organizerUserId,
      isChallengerCaptain: true,
      requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
      requestedEndAt: new Date("2026-10-12T19:30:00.000Z"), // 90 min
      pitch: { ...defaultPitch },
      now: fixedNow,
      ...overrides,
    };
  }

  describe("happy path", () => {
    it("accepts a matching booking request computed from pitch rules", () => {
      const input = createValidInput();
      const result = assertBookingCompatible(input);

      expect(result.compatible).toBe(true);
      expect(result.durationMinutes).toBe(90);
      expect(result.distanceKm).toBeCloseTo(0, 3);
      // 90 minutes at 4,000 DZD/hour = 6,000.00 DZD = 600,000 minor
      expect(result.priceAmountMinor).toBe(600000);
      expect(result.currency).toBe("DZD");
      expect(result.slot.startAt).toBe("2026-10-12T18:00:00.000Z");
      expect(result.slot.endAt).toBe("2026-10-12T19:30:00.000Z");
    });

    it("accepts when precomputed availableSlots array is supplied", () => {
      const slot: AvailableSlot = {
        startAt: "2026-10-12T18:00:00.000Z",
        endAt: "2026-10-12T19:30:00.000Z",
        price: { amountMinor: 600000, currency: "DZD" },
      };
      const input = createValidInput({
        pitch: { ...defaultPitch, availabilityRules: [] },
        availableSlots: [slot],
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
      expect(result.priceAmountMinor).toBe(600000);
      expect(result.slot).toEqual(slot);
    });

    it("accepts exact full challenge window when duration is within 180 min (e.g. 120 min)", () => {
      const input = createValidInput({
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T20:00:00.000Z"), // 120 min
      });
      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
      expect(result.durationMinutes).toBe(120);
      expect(result.priceAmountMinor).toBe(800000); // 120 min at 4,000 DZD/hour
    });
  });

  describe("challenge status and booking deadline boundaries (stale challenge -> 409 STATE_CONFLICT)", () => {
    it.each([
      "PENDING",
      "DECLINED",
      "CANCELLED",
      "EXPIRED",
    ] as const)("rejects with 409 STATE_CONFLICT when challenge status is %s", (status) => {
      const input = createValidInput({
        challenge: { ...defaultChallenge, status },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "STATE_CONFLICT",
        }),
      );
    });

    it("rejects when booking deadline is missing or null", () => {
      const input = createValidInput({
        challenge: { ...defaultChallenge, bookingDeadline: null },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "STATE_CONFLICT",
        }),
      );
    });

    it("accepts when clock is 1 millisecond before booking deadline", () => {
      const input = createValidInput({
        now: new Date(deadline.getTime() - 1),
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });

    it("rejects with 409 STATE_CONFLICT when clock is exactly at booking deadline", () => {
      const input = createValidInput({
        now: new Date(deadline.getTime()),
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "STATE_CONFLICT",
          message: expect.stringContaining("booking deadline has passed"),
        }),
      );
    });

    it("rejects with 409 STATE_CONFLICT when clock is past booking deadline", () => {
      const input = createValidInput({
        now: new Date(deadline.getTime() + 1000),
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "STATE_CONFLICT",
        }),
      );
    });
  });

  describe("actor authorization and captaincy (agreement mismatch -> 422 CONDITIONS_VIOLATION)", () => {
    it("rejects with 422 CONDITIONS_VIOLATION when actor is not the challenge organizer", () => {
      const input = createValidInput({
        actorId: "different-user-id",
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("not the agreed challenge organizer"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when actor is organizer but isChallengerCaptain is false", () => {
      const input = createValidInput({
        isChallengerCaptain: false,
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("not an active captain"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when challengerMemberships does not include actor as CAPTAIN", () => {
      const input = createValidInput({
        isChallengerCaptain: undefined,
        challengerMemberships: [
          { userId: organizerUserId, role: "PLAYER", status: "ACTIVE" },
        ],
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when captain membership is inactive", () => {
      const input = createValidInput({
        isChallengerCaptain: undefined,
        challengerMemberships: [
          { userId: organizerUserId, role: "CAPTAIN", status: "SUSPENDED" },
        ],
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
        }),
      );
    });

    it("accepts when challengerMemberships confirms actor is active CAPTAIN", () => {
      const input = createValidInput({
        isChallengerCaptain: undefined,
        challengerMemberships: [
          { userId: organizerUserId, role: "CAPTAIN", status: "ACTIVE" },
        ],
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });

    it("rejects with 422 CONDITIONS_VIOLATION when captain evidence is completely missing", () => {
      const input = createValidInput({
        isChallengerCaptain: undefined,
        challengerMemberships: undefined,
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("Actor is not an active captain of the challenger team"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when challengerMemberships is empty array", () => {
      const input = createValidInput({
        isChallengerCaptain: undefined,
        challengerMemberships: [],
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("Actor is not an active captain of the challenger team"),
        }),
      );
    });
  });

  describe("window containment boundaries (agreement mismatch -> 422 CONDITIONS_VIOLATION)", () => {
    it("accepts when requested window matches challenge start and end exactly (within 180 min)", () => {
      const input = createValidInput({
        requestedStartAt: challengeStart,
        requestedEndAt: new Date(challengeStart.getTime() + 120 * 60000), // 120 min
      });
      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });

    it("accepts when requested window is strictly inside challenge window", () => {
      const input = createValidInput({
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T19:30:00.000Z"),
      });
      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });

    it("rejects with 422 CONDITIONS_VIOLATION when requested start is 1 minute before challenge start", () => {
      const input = createValidInput({
        requestedStartAt: new Date(challengeStart.getTime() - 60000),
        requestedEndAt: new Date("2026-10-12T19:30:00.000Z"),
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("within the accepted challenge window"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when requested end is 1 minute after challenge end", () => {
      const input = createValidInput({
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date(challengeEnd.getTime() + 60000),
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("within the accepted challenge window"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when requested end is before or equal to start", () => {
      const input = createValidInput({
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T18:00:00.000Z"),
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
        }),
      );
    });
  });

  describe("duration boundaries (30–180 minutes)", () => {
    it("rejects with 422 CONDITIONS_VIOLATION when duration is 29 minutes (under lower boundary)", () => {
      const input = createValidInput({
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T18:29:00.000Z"), // 29 min
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("between 30 and 180 minutes"),
        }),
      );
    });

    it("accepts when duration is exactly 30 minutes (minimum boundary)", () => {
      const input = createValidInput({
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T18:30:00.000Z"), // 30 min
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
      expect(result.durationMinutes).toBe(30);
      expect(result.priceAmountMinor).toBe(200000); // 30m at 4,000 DZD/h = 2,000 DZD
    });

    it("accepts when duration is exactly 180 minutes (maximum boundary)", () => {
      const extendedChallengeEnd = new Date("2026-10-12T21:00:00.000Z");
      const input = createValidInput({
        challenge: { ...defaultChallenge, endAt: extendedChallengeEnd },
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T21:00:00.000Z"), // 180 min
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
      expect(result.durationMinutes).toBe(180);
      expect(result.priceAmountMinor).toBe(1200000); // 180m at 4,000 DZD/h = 12,000 DZD
    });

    it("rejects with 422 CONDITIONS_VIOLATION when duration is 181 minutes (over upper boundary)", () => {
      const extendedChallengeEnd = new Date("2026-10-12T21:10:00.000Z");
      const input = createValidInput({
        challenge: { ...defaultChallenge, endAt: extendedChallengeEnd },
        requestedStartAt: new Date("2026-10-12T18:00:00.000Z"),
        requestedEndAt: new Date("2026-10-12T21:01:00.000Z"), // 181 min
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("between 30 and 180 minutes"),
        }),
      );
    });
  });

  describe("pitch active state and format match (agreement mismatch -> 422 CONDITIONS_VIOLATION)", () => {
    it("rejects with 422 CONDITIONS_VIOLATION when pitch is not active", () => {
      const input = createValidInput({
        pitch: { ...defaultPitch, isActive: false },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("not active"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when pitch format does not match challenge format", () => {
      const input = createValidInput({
        pitch: { ...defaultPitch, size: "SEVEN_A_SIDE" },
        challenge: { ...defaultChallenge, format: "FIVE_A_SIDE" },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("format (SEVEN_A_SIDE) does not match"),
        }),
      );
    });

    it("accepts when pitch is active and format matches exactly", () => {
      const input = createValidInput({
        pitch: { ...defaultPitch, isActive: true, size: "SEVEN_A_SIDE" },
        challenge: { ...defaultChallenge, format: "SEVEN_A_SIDE" },
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });
  });

  describe("pitch distance and radius boundaries (agreement mismatch -> 422 CONDITIONS_VIOLATION)", () => {
    it("accepts when pitch is at origin (distance 0 km)", () => {
      const input = createValidInput({
        pitch: { ...defaultPitch, lat: originLat, lng: originLng },
      });

      const result = assertBookingCompatible(input);
      expect(result.distanceKm).toBeCloseTo(0, 3);
    });

    it("accepts when pitch is within radius (e.g. 2.6 km away with radius 10 km)", () => {
      // Hydra (~2.6 km from Algiers Center)
      const input = createValidInput({
        pitch: { ...defaultPitch, lat: 36.7414, lng: 3.0336 },
        challenge: { ...defaultChallenge, radiusKm: 10 },
      });

      const result = assertBookingCompatible(input);
      expect(result.distanceKm).toBeLessThan(10);
      expect(result.distanceKm).toBeGreaterThan(2);
    });

    it("accepts when pitch distance is exactly at the radius boundary", () => {
      const pitchCoords = { lat: 36.7414, lng: 3.0336 };
      const calculatedDistance = 2.6348412758404094;

      const input = createValidInput({
        pitch: { ...defaultPitch, lat: pitchCoords.lat, lng: pitchCoords.lng },
        challenge: { ...defaultChallenge, radiusKm: calculatedDistance },
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
      expect(result.distanceKm).toBeCloseTo(calculatedDistance, 6);
    });

    it("rejects when pitch distance slightly exceeds radius boundary by epsilon", () => {
      const pitchCoords = { lat: 36.7414, lng: 3.0336 };
      const calculatedDistance = 2.6348412758404094;

      const input = createValidInput({
        pitch: { ...defaultPitch, lat: pitchCoords.lat, lng: pitchCoords.lng },
        challenge: { ...defaultChallenge, radiusKm: calculatedDistance - 0.01 },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("exceeds accepted radius"),
        }),
      );
    });

    it("rejects with 422 CONDITIONS_VIOLATION when pitch is well beyond accepted radius", () => {
      // Bab Ezzouar (~11.6 km from Algiers Center) with 10 km radius
      const input = createValidInput({
        pitch: { ...defaultPitch, lat: 36.7167, lng: 3.1833 },
        challenge: { ...defaultChallenge, radiusKm: 10 },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 422,
          code: "CONDITIONS_VIOLATION",
          message: expect.stringContaining("exceeds accepted radius"),
        }),
      );
    });
  });

  describe("pitch inventory and blocking (unavailable inventory -> 409 INVENTORY_CONFLICT)", () => {
    it("rejects with 409 INVENTORY_CONFLICT when requested time is outside pitch operating hours", () => {
      // Rule ends at 17:00 local (16:00 UTC), requested at 18:00 UTC
      const restrictedRules: PitchAvailabilityRule[] = [
        {
          ...defaultAvailabilityRules[0]!,
          endMinute: 1020, // 17:00 local
          endTime: "17:00",
        },
      ];
      const input = createValidInput({
        pitch: { ...defaultPitch, availabilityRules: restrictedRules },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "INVENTORY_CONFLICT",
        }),
      );
    });

    it("rejects with 409 INVENTORY_CONFLICT when pitch has an active block overlapping requested slot", () => {
      const activeBlock: PitchBlock = {
        id: "block-maintenance",
        pitchId: "pitch-1",
        startAt: new Date("2026-10-12T18:30:00.000Z").toISOString(),
        endAt: new Date("2026-10-12T19:30:00.000Z").toISOString(),
        reason: "Floodlight maintenance",
        createdById: "owner-1",
        createdAt: "2026-10-01T00:00:00.000Z",
        cancelledAt: null,
      };

      const input = createValidInput({
        pitch: { ...defaultPitch, blocks: [activeBlock] },
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "INVENTORY_CONFLICT",
        }),
      );
    });

    it("ignores cancelled pitch blocks and produces the slot", () => {
      const cancelledBlock: PitchBlock = {
        id: "block-maintenance",
        pitchId: "pitch-1",
        startAt: new Date("2026-10-12T18:30:00.000Z").toISOString(),
        endAt: new Date("2026-10-12T19:30:00.000Z").toISOString(),
        reason: "Cancelled maintenance",
        createdById: "owner-1",
        createdAt: "2026-10-01T00:00:00.000Z",
        cancelledAt: "2026-10-05T00:00:00.000Z",
      };

      const input = createValidInput({
        pitch: { ...defaultPitch, blocks: [cancelledBlock] },
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });

    it("rejects with 409 INVENTORY_CONFLICT when extraBlocks (another booking) overlaps requested slot", () => {
      const overlappingBookingBlock: BlockingRange = {
        startAt: new Date("2026-10-12T19:00:00.000Z"),
        endAt: new Date("2026-10-12T20:00:00.000Z"),
      };

      const input = createValidInput({
        extraBlocks: [overlappingBookingBlock],
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "INVENTORY_CONFLICT",
        }),
      );
    });

    it("accepts when adjacent extraBlock touches boundary without positive overlap", () => {
      const adjacentBookingBlock: BlockingRange = {
        startAt: new Date("2026-10-12T19:30:00.000Z"), // touches end of requested 18:00–19:30
        endAt: new Date("2026-10-12T21:00:00.000Z"),
      };

      const input = createValidInput({
        extraBlocks: [adjacentBookingBlock],
      });

      const result = assertBookingCompatible(input);
      expect(result.compatible).toBe(true);
    });

    it("rejects with 409 INVENTORY_CONFLICT when precomputed availableSlots array does not include requested slot", () => {
      const differentSlot: AvailableSlot = {
        startAt: "2026-10-12T16:00:00.000Z",
        endAt: "2026-10-12T17:30:00.000Z",
        price: { amountMinor: 600000, currency: "DZD" },
      };

      const input = createValidInput({
        pitch: { ...defaultPitch, availabilityRules: [] },
        availableSlots: [differentSlot],
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "INVENTORY_CONFLICT",
        }),
      );
    });
    it("rejects with 409 INVENTORY_CONFLICT when availableSlots is explicitly an empty array even if pitch rules exist", () => {
      const input = createValidInput({
        availableSlots: [],
      });

      expect(() => assertBookingCompatible(input)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "INVENTORY_CONFLICT",
        }),
      );
    });
  });
});
