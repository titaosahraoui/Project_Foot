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
});
