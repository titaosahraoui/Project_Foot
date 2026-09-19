import { describe, expect, it } from "vitest";
import type { Money, PitchAvailabilityRule, PitchBlock } from "@footconnect/shared";
import { computeAvailableSlots } from "./inventory";

describe("inventory engine (M05-T03)", () => {
  const hourlyRate: Money = { amountMinor: 400000, currency: "DZD" }; // 4,000 DZD/hr

  const sampleRules: PitchAvailabilityRule[] = [
    {
      id: "rule-1",
      pitchId: "pitch-1",
      dayOfWeek: 5, // Friday
      startMinute: 540, // 09:00 Algiers (08:00 UTC)
      endMinute: 720, // 12:00 Algiers (11:00 UTC)
      startTime: "09:00",
      endTime: "12:00",
      timezone: "Africa/Algiers",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule-2",
      pitchId: "pitch-1",
      dayOfWeek: 6, // Saturday
      startMinute: 1080, // 18:00 Algiers (17:00 UTC)
      endMinute: 1260, // 21:00 Algiers (20:00 UTC)
      startTime: "18:00",
      endTime: "21:00",
      timezone: "Africa/Algiers",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule-3",
      pitchId: "pitch-1",
      dayOfWeek: 0, // Sunday
      startMinute: 600, // 10:00 Algiers (09:00 UTC)
      endMinute: 780, // 13:00 Algiers (12:00 UTC)
      startTime: "10:00",
      endTime: "13:00",
      timezone: "Africa/Algiers",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("converts Algiers local time to exact UTC slot candidates", () => {
    // Friday 2026-08-21 00:00 UTC to 23:59 UTC
    const from = new Date("2026-08-21T00:00:00.000Z");
    const to = new Date("2026-08-21T23:59:59.999Z");

    const slots = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks: [],
      from,
      to,
      durationMinutes: 60,
    });

    // 09:00-12:00 in Algiers = 08:00-11:00 in UTC (3 slots of 60 min)
    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual({
      startAt: "2026-08-21T08:00:00.000Z",
      endAt: "2026-08-21T09:00:00.000Z",
      price: { amountMinor: 400000, currency: "DZD" },
    });
    expect(slots[1]).toEqual({
      startAt: "2026-08-21T09:00:00.000Z",
      endAt: "2026-08-21T10:00:00.000Z",
      price: { amountMinor: 400000, currency: "DZD" },
    });
    expect(slots[2]).toEqual({
      startAt: "2026-08-21T10:00:00.000Z",
      endAt: "2026-08-21T11:00:00.000Z",
      price: { amountMinor: 400000, currency: "DZD" },
    });
  });

  it("handles week boundary transition from Saturday to Sunday", () => {
    // Spanning Saturday 2026-08-22 to Sunday 2026-08-23
    const from = new Date("2026-08-22T00:00:00.000Z");
    const to = new Date("2026-08-23T23:59:59.999Z");

    const slots = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks: [],
      from,
      to,
      durationMinutes: 60,
    });

    // Saturday: 18:00-21:00 Algiers = 17:00-20:00 UTC (3 slots)
    // Sunday: 10:00-13:00 Algiers = 09:00-12:00 UTC (3 slots)
    expect(slots).toHaveLength(6);

    // Verify chronological order
    expect(slots[0]?.startAt).toBe("2026-08-22T17:00:00.000Z");
    expect(slots[2]?.endAt).toBe("2026-08-22T20:00:00.000Z");
    expect(slots[3]?.startAt).toBe("2026-08-23T09:00:00.000Z");
    expect(slots[5]?.endAt).toBe("2026-08-23T12:00:00.000Z");
  });

  it("calculates proportional price for 90-minute and 30-minute durations", () => {
    const from = new Date("2026-08-21T00:00:00.000Z");
    const to = new Date("2026-08-21T23:59:59.999Z");

    // 90 minutes in a 3-hour (180 min) window yields 2 slots
    const slots90 = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks: [],
      from,
      to,
      durationMinutes: 90,
    });

    expect(slots90).toHaveLength(2);
    // 400000 * 90 / 60 = 600000 (6,000 DZD)
    expect(slots90[0]?.price).toEqual({ amountMinor: 600000, currency: "DZD" });
    expect(slots90[0]?.startAt).toBe("2026-08-21T08:00:00.000Z");
    expect(slots90[0]?.endAt).toBe("2026-08-21T09:30:00.000Z");
    expect(slots90[1]?.startAt).toBe("2026-08-21T09:30:00.000Z");
    expect(slots90[1]?.endAt).toBe("2026-08-21T11:00:00.000Z");

    // 30 minutes in a 3-hour window yields 6 slots
    const slots30 = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks: [],
      from,
      to,
      durationMinutes: 30,
    });
    expect(slots30).toHaveLength(6);
    // 400000 * 30 / 60 = 200000 (2,000 DZD)
    expect(slots30[0]?.price).toEqual({ amountMinor: 200000, currency: "DZD" });
  });

  it("subtracts active pitch blocks and preserves non-overlapping slots", () => {
    const from = new Date("2026-08-21T00:00:00.000Z");
    const to = new Date("2026-08-21T23:59:59.999Z");

    // Block the second slot: 09:00-10:00 UTC (10:00-11:00 Algiers)
    const blocks: PitchBlock[] = [
      {
        id: "block-1",
        pitchId: "pitch-1",
        startAt: "2026-08-21T09:00:00.000Z",
        endAt: "2026-08-21T10:00:00.000Z",
        reason: "Field maintenance",
        createdById: "owner-1",
        createdAt: new Date().toISOString(),
        cancelledAt: null,
      },
    ];

    const slots = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks,
      from,
      to,
      durationMinutes: 60,
    });

    // Only slot 1 (08:00-09:00) and slot 3 (10:00-11:00) remain
    expect(slots).toHaveLength(2);
    expect(slots[0]?.startAt).toBe("2026-08-21T08:00:00.000Z");
    expect(slots[0]?.endAt).toBe("2026-08-21T09:00:00.000Z");
    expect(slots[1]?.startAt).toBe("2026-08-21T10:00:00.000Z");
    expect(slots[1]?.endAt).toBe("2026-08-21T11:00:00.000Z");
  });

  it("ignores cancelled pitch blocks", () => {
    const from = new Date("2026-08-21T00:00:00.000Z");
    const to = new Date("2026-08-21T23:59:59.999Z");

    const blocks: PitchBlock[] = [
      {
        id: "block-cancelled",
        pitchId: "pitch-1",
        startAt: "2026-08-21T08:00:00.000Z",
        endAt: "2026-08-21T11:00:00.000Z",
        reason: "Cancelled maintenance",
        createdById: "owner-1",
        createdAt: new Date().toISOString(),
        cancelledAt: new Date().toISOString(), // CANCELLED
      },
    ];

    const slots = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks,
      from,
      to,
      durationMinutes: 60,
    });

    // All 3 slots remain available
    expect(slots).toHaveLength(3);
  });

  it("subtracts extra blocking ranges for future booking integration", () => {
    const from = new Date("2026-08-21T00:00:00.000Z");
    const to = new Date("2026-08-21T23:59:59.999Z");

    const extraBlocks = [
      {
        startAt: new Date("2026-08-21T08:00:00.000Z"),
        endAt: new Date("2026-08-21T09:00:00.000Z"),
      },
    ];

    const slots = computeAvailableSlots({
      hourlyRate,
      rules: sampleRules,
      blocks: [],
      from,
      to,
      durationMinutes: 60,
      extraBlocks,
    });

    expect(slots).toHaveLength(2);
    expect(slots[0]?.startAt).toBe("2026-08-21T09:00:00.000Z");
  });

  it("rejects invalid date ranges and excessive durations", () => {
    const from = new Date("2026-08-21T10:00:00.000Z");
    const to = new Date("2026-08-21T08:00:00.000Z"); // to before from

    expect(() =>
      computeAvailableSlots({
        hourlyRate,
        rules: sampleRules,
        blocks: [],
        from,
        to,
        durationMinutes: 60,
      }),
    ).toThrow("to timestamp must be after from timestamp");

    // Range exceeding 31 days
    const farTo = new Date("2026-09-25T10:00:00.000Z");
    expect(() =>
      computeAvailableSlots({
        hourlyRate,
        rules: sampleRules,
        blocks: [],
        from,
        to: farTo,
        durationMinutes: 60,
      }),
    ).toThrow("Query range cannot exceed 31 days");

    // Duration outside 30..180
    expect(() =>
      computeAvailableSlots({
        hourlyRate,
        rules: sampleRules,
        blocks: [],
        from,
        to: new Date("2026-08-22T10:00:00.000Z"),
        durationMinutes: 20,
      }),
    ).toThrow("durationMinutes must be between 30 and 180");
  });

  describe("boundary regression cases (M05-T07)", () => {
    it("preserves Africa/Algiers fixed UTC+1 offset without daylight saving shifts across summer and winter", () => {
      // Winter: Friday 2026-01-16. Rule: 18:00 to 20:00 local Algiers (startMinute 1080, endMinute 1200)
      const winterFridayRule: PitchAvailabilityRule = {
        id: "winter-rule",
        pitchId: "pitch-1",
        dayOfWeek: 5,
        startMinute: 1080, // 18:00
        endMinute: 1200, // 20:00
        startTime: "18:00",
        endTime: "20:00",
        timezone: "Africa/Algiers",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const winterFrom = new Date("2026-01-16T00:00:00.000Z");
      const winterTo = new Date("2026-01-16T23:59:59.999Z");

      const winterSlots = computeAvailableSlots({
        hourlyRate,
        rules: [winterFridayRule],
        blocks: [],
        from: winterFrom,
        to: winterTo,
        durationMinutes: 60,
      });

      expect(winterSlots).toHaveLength(2);
      // 18:00 Algiers = 17:00 UTC in January
      expect(winterSlots[0]?.startAt).toBe("2026-01-16T17:00:00.000Z");
      expect(winterSlots[0]?.endAt).toBe("2026-01-16T18:00:00.000Z");
      expect(winterSlots[1]?.startAt).toBe("2026-01-16T18:00:00.000Z");
      expect(winterSlots[1]?.endAt).toBe("2026-01-16T19:00:00.000Z");

      // Summer: Friday 2026-07-17. Rule: 18:00 to 20:00 local Algiers.
      // Unlike Europe (which shifts to UTC+2 for CEST), Algeria does NOT observe DST and stays UTC+1.
      const summerFridayRule: PitchAvailabilityRule = {
        ...winterFridayRule,
        id: "summer-rule",
      };

      const summerFrom = new Date("2026-07-17T00:00:00.000Z");
      const summerTo = new Date("2026-07-17T23:59:59.999Z");

      const summerSlots = computeAvailableSlots({
        hourlyRate,
        rules: [summerFridayRule],
        blocks: [],
        from: summerFrom,
        to: summerTo,
        durationMinutes: 60,
      });

      expect(summerSlots).toHaveLength(2);
      // 18:00 Algiers STILL = 17:00 UTC in July (proving fixed UTC+1)
      expect(summerSlots[0]?.startAt).toBe("2026-07-17T17:00:00.000Z");
      expect(summerSlots[0]?.endAt).toBe("2026-07-17T18:00:00.000Z");
      expect(summerSlots[1]?.startAt).toBe("2026-07-17T18:00:00.000Z");
      expect(summerSlots[1]?.endAt).toBe("2026-07-17T19:00:00.000Z");
    });

    it("verifies exact boundary of 31-day query cap", () => {
      const from = new Date("2026-08-01T00:00:00.000Z");
      const exactly31DaysLater = new Date(from.getTime() + 31 * 24 * 60 * 60 * 1000);

      // Exactly 31 days is allowed
      expect(() =>
        computeAvailableSlots({
          hourlyRate,
          rules: sampleRules,
          blocks: [],
          from,
          to: exactly31DaysLater,
          durationMinutes: 60,
        }),
      ).not.toThrow();

      // 31 days + 1 millisecond exceeds cap
      const over31Days = new Date(exactly31DaysLater.getTime() + 1);
      expect(() =>
        computeAvailableSlots({
          hourlyRate,
          rules: sampleRules,
          blocks: [],
          from,
          to: over31Days,
          durationMinutes: 60,
        }),
      ).toThrow("Query range cannot exceed 31 days");
    });

    it("deduplicates overlapping rules on the same day", () => {
      // Two overlapping rules on Friday:
      // Rule 1: 09:00 - 12:00 (540..720) -> 09:00-10:00, 10:00-11:00, 11:00-12:00
      // Rule 2: 10:00 - 13:00 (600..780) -> 10:00-11:00, 11:00-12:00, 12:00-13:00
      const overlappingRules: PitchAvailabilityRule[] = [
        {
          id: "rule-overlap-1",
          pitchId: "pitch-1",
          dayOfWeek: 5,
          startMinute: 540,
          endMinute: 720,
          startTime: "09:00",
          endTime: "12:00",
          timezone: "Africa/Algiers",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rule-overlap-2",
          pitchId: "pitch-1",
          dayOfWeek: 5,
          startMinute: 600,
          endMinute: 780,
          startTime: "10:00",
          endTime: "13:00",
          timezone: "Africa/Algiers",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const from = new Date("2026-08-21T00:00:00.000Z");
      const to = new Date("2026-08-21T23:59:59.999Z");

      const slots = computeAvailableSlots({
        hourlyRate,
        rules: overlappingRules,
        blocks: [],
        from,
        to,
        durationMinutes: 60,
      });

      // Instead of 6 slots with duplicate 10:00 and 11:00 slots, there should be exactly 4 unique slots
      expect(slots).toHaveLength(4);
      expect(slots.map((s) => s.startAt)).toEqual([
        "2026-08-21T08:00:00.000Z", // 09:00 local
        "2026-08-21T09:00:00.000Z", // 10:00 local
        "2026-08-21T10:00:00.000Z", // 11:00 local
        "2026-08-21T11:00:00.000Z", // 12:00 local
      ]);
    });

    it("seamlessly connects adjacent non-overlapping rules across the rule boundary", () => {
      // Rule 1: Friday 09:00 - 12:00 (540..720)
      // Rule 2: Friday 12:00 - 15:00 (720..900)
      const adjacentRules: PitchAvailabilityRule[] = [
        {
          id: "rule-adj-1",
          pitchId: "pitch-1",
          dayOfWeek: 5,
          startMinute: 540,
          endMinute: 720,
          startTime: "09:00",
          endTime: "12:00",
          timezone: "Africa/Algiers",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rule-adj-2",
          pitchId: "pitch-1",
          dayOfWeek: 5,
          startMinute: 720,
          endMinute: 900,
          startTime: "12:00",
          endTime: "15:00",
          timezone: "Africa/Algiers",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const from = new Date("2026-08-21T00:00:00.000Z");
      const to = new Date("2026-08-21T23:59:59.999Z");

      const slots = computeAvailableSlots({
        hourlyRate,
        rules: adjacentRules,
        blocks: [],
        from,
        to,
        durationMinutes: 60,
      });

      // 6 continuous slots across 09:00 to 15:00 local (08:00 to 14:00 UTC)
      expect(slots).toHaveLength(6);
      expect(slots[0]?.startAt).toBe("2026-08-21T08:00:00.000Z");
      expect(slots[2]?.endAt).toBe("2026-08-21T11:00:00.000Z"); // 12:00 local
      expect(slots[3]?.startAt).toBe("2026-08-21T11:00:00.000Z"); // 12:00 local
      expect(slots[5]?.endAt).toBe("2026-08-21T14:00:00.000Z"); // 15:00 local
    });

    it("verifies partial and inactive closures", () => {
      const from = new Date("2026-08-21T00:00:00.000Z");
      const to = new Date("2026-08-21T23:59:59.999Z");

      // Active closure partially overlaps second slot: 09:15 to 09:45 UTC (10:15 to 10:45 Algiers)
      // Second slot (09:00-10:00 UTC) must be suppressed, while 08:00-09:00 and 10:00-11:00 remain
      const activePartialBlock: PitchBlock = {
        id: "block-partial",
        pitchId: "pitch-1",
        startAt: "2026-08-21T09:15:00.000Z",
        endAt: "2026-08-21T09:45:00.000Z",
        reason: "Spike inspection",
        createdById: "owner-1",
        createdAt: new Date().toISOString(),
        cancelledAt: null,
      };

      // Inactive closure for third slot (10:00-11:00 UTC)
      const inactiveBlock: PitchBlock = {
        id: "block-cancelled-later",
        pitchId: "pitch-1",
        startAt: "2026-08-21T10:00:00.000Z",
        endAt: "2026-08-21T11:00:00.000Z",
        reason: "Rain delay",
        createdById: "owner-1",
        createdAt: new Date().toISOString(),
        cancelledAt: new Date().toISOString(), // CANCELLED
      };

      const slots = computeAvailableSlots({
        hourlyRate,
        rules: sampleRules,
        blocks: [activePartialBlock, inactiveBlock],
        from,
        to,
        durationMinutes: 60,
      });

      expect(slots).toHaveLength(2);
      expect(slots[0]?.startAt).toBe("2026-08-21T08:00:00.000Z");
      expect(slots[1]?.startAt).toBe("2026-08-21T10:00:00.000Z");
    });

    it("accurately serializes DZD prices across all standard match durations", () => {
      const from = new Date("2026-08-21T00:00:00.000Z");
      const to = new Date("2026-08-21T23:59:59.999Z");

      // Test 120-minute match: 400,000 * 120 / 60 = 800,000 minor units (8,000 DZD)
      const slots120 = computeAvailableSlots({
        hourlyRate,
        rules: sampleRules,
        blocks: [],
        from,
        to,
        durationMinutes: 120,
      });
      expect(slots120.length).toBeGreaterThan(0);
      expect(slots120[0]?.price).toEqual({
        amountMinor: 800000,
        currency: "DZD",
      });

      // Test 180-minute match: 400,000 * 180 / 60 = 1,200,000 minor units (12,000 DZD)
      const slots180 = computeAvailableSlots({
        hourlyRate,
        rules: sampleRules,
        blocks: [],
        from,
        to,
        durationMinutes: 180,
      });
      expect(slots180.length).toBe(1);
      expect(slots180[0]?.price).toEqual({
        amountMinor: 1200000,
        currency: "DZD",
      });
    });
  });
});
