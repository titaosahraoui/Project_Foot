import { describe, expect, it } from "vitest";
import {
  ALGIERS_OFFSET_MS,
  MIN_LEAD_TIME_HOURS,
  algiersToUtcIso,
  formatAlgiersDateTime,
  formatAlgiersTimeRange,
  getAlgiersNow,
  getAvailabilityCountdown,
  utcToAlgiersComponents,
  validateAvailabilityInput,
} from "./algiers-time";

describe("Algiers Time & Matchmaking Controls (M06-T05)", () => {
  const FROZEN_NOW = new Date("2026-10-04T12:00:00.000Z"); // 12:00 UTC = 13:00 Algiers

  describe("Algiers local time conversion (UTC+1 single conversion)", () => {
    it("converts local Algiers datetime to UTC ISO once", () => {
      // 2026-10-05 18:30 Algiers time is 2026-10-05 17:30 UTC
      const utcIso = algiersToUtcIso("2026-10-05", "18:30");
      expect(utcIso).toBe("2026-10-05T17:30:00.000Z");
    });

    it("converts midnight Algiers time across date boundary", () => {
      // 2026-10-05 00:30 Algiers time is 2026-10-04 23:30 UTC
      const utcIso = algiersToUtcIso("2026-10-05", "00:30");
      expect(utcIso).toBe("2026-10-04T23:30:00.000Z");
    });

    it("correctly extracts Algiers components from UTC ISO", () => {
      const comp = utcToAlgiersComponents("2026-10-05T17:30:00.000Z");
      expect(comp.dateStr).toBe("2026-10-05");
      expect(comp.timeStr).toBe("18:30");
      expect(comp.hours).toBe(18);
      expect(comp.minutes).toBe(30);
    });

    it("formats Algiers time range with duration", () => {
      const startUtc = "2026-10-05T17:00:00.000Z"; // 18:00 Algiers
      const endUtc = "2026-10-05T19:00:00.000Z"; // 20:00 Algiers
      const formatted = formatAlgiersTimeRange(startUtc, endUtc);
      expect(formatted).toContain("18:00 – 20:00");
      expect(formatted).toContain("120m");
    });
  });

  describe("Manual Case 1: All Match Formats (5v5, 7v7, 11v11)", () => {
    const validDate = "2026-10-05";
    const validTime = "19:00"; // 19:00 Algiers = 18:00 UTC (well > 6h from 12:00 UTC)

    it("validates 5v5 (FIVE_A_SIDE) format with captain", () => {
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 150,
          message: "5v5 match on turf",
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual({});
      expect(res.startUtcIso).toBe("2026-10-05T18:00:00.000Z");
      expect(res.endUtcIso).toBe("2026-10-05T19:30:00.000Z");
    });

    it("validates 7v7 (SEVEN_A_SIDE) format with captain", () => {
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 120,
          radiusKm: 15,
          eloTolerance: 200,
          message: "7v7 competitive match",
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual({});
    });

    it("validates 11v11 (ELEVEN_A_SIDE) format with captain", () => {
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 180,
          radiusKm: 25,
          eloTolerance: 300,
          message: "11v11 full match with referee",
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual({});
    });
  });

  describe("Manual Case 2: Invalid Lead Time (< 6 hours in Algiers)", () => {
    it("rejects match window starting only 2 hours ahead", () => {
      // FROZEN_NOW is 12:00 UTC (13:00 Algiers on 2026-10-04)
      // Attempting to set 15:00 Algiers (only 2 hours ahead)
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: "2026-10-04",
          timeStr: "15:00",
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(false);
      expect(res.errors.startAt).toContain(
        `Must start at least ${MIN_LEAD_TIME_HOURS} hours in advance`,
      );
    });

    it("rejects match window starting exactly 5 hours and 59 minutes ahead", () => {
      // 13:00 + 5h 59m = 18:59 Algiers
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: "2026-10-04",
          timeStr: "18:59",
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(false);
      expect(res.errors.startAt).toContain("hours in advance");
    });

    it("accepts match window starting exactly 6 hours ahead", () => {
      // 13:00 + 6h = 19:00 Algiers
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: "2026-10-04",
          timeStr: "19:00",
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(true);
      expect(res.errors.startAt).toBeUndefined();
    });
  });

  describe("Manual Case 3: Member vs Captain Access", () => {
    it("rejects non-captain member attempting to create availability", () => {
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: false,
          dateStr: "2026-10-05",
          timeStr: "20:00",
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(false);
      expect(res.errors.teamId).toBe(
        "Only the active team captain can set availability",
      );
    });
  });

  describe("Manual Case 4: Field Boundary Validations", () => {
    const validDate = "2026-10-05";
    const validTime = "20:00";

    it("rejects duration < 60 minutes", () => {
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 45,
          radiusKm: 10,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(false);
      expect(res.errors.durationMinutes).toContain("between 60 and 240 minutes");
    });

    it("rejects duration > 240 minutes", () => {
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 300,
          radiusKm: 10,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(false);
      expect(res.errors.durationMinutes).toContain("between 60 and 240 minutes");
    });

    it("rejects radius < 1 km or > 50 km", () => {
      const resLow = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 90,
          radiusKm: 0,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(resLow.valid).toBe(false);
      expect(resLow.errors.radiusKm).toContain("between 1 and 50 km");

      const resHigh = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 90,
          radiusKm: 60,
          eloTolerance: 150,
        },
        FROZEN_NOW,
      );
      expect(resHigh.valid).toBe(false);
      expect(resHigh.errors.radiusKm).toContain("between 1 and 50 km");
    });

    it("rejects Elo tolerance < 50 or > 500", () => {
      const resLow = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 20,
        },
        FROZEN_NOW,
      );
      expect(resLow.valid).toBe(false);
      expect(resLow.errors.eloTolerance).toContain("between 50 and 500");

      const resHigh = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 600,
        },
        FROZEN_NOW,
      );
      expect(resHigh.valid).toBe(false);
      expect(resHigh.errors.eloTolerance).toContain("between 50 and 500");
    });

    it("rejects message > 280 characters", () => {
      const longMessage = "a".repeat(281);
      const res = validateAvailabilityInput(
        {
          teamId: "team-123",
          isCaptain: true,
          dateStr: validDate,
          timeStr: validTime,
          durationMinutes: 90,
          radiusKm: 10,
          eloTolerance: 150,
          message: longMessage,
        },
        FROZEN_NOW,
      );
      expect(res.valid).toBe(false);
      expect(res.errors.message).toBe("Message must not exceed 280 characters");
    });
  });

  describe("Countdown and Status Copy for all states", () => {
    const startUtc = "2026-10-04T20:00:00.000Z";
    const endUtc = "2026-10-04T22:00:00.000Z";
    const expiresUtc = startUtc;

    it("shows countdown when OPEN and future", () => {
      const cd = getAvailabilityCountdown(
        "OPEN",
        startUtc,
        endUtc,
        expiresUtc,
        new Date("2026-10-04T12:00:00.000Z"),
      );
      expect(cd.headline).toContain("Starts in 8h");
      expect(cd.isExpired).toBe(false);
    });

    it("shows window in progress when OPEN and during match window", () => {
      const cd = getAvailabilityCountdown(
        "OPEN",
        startUtc,
        endUtc,
        endUtc, // expires at end of window
        new Date("2026-10-04T21:00:00.000Z"),
      );
      expect(cd.headline).toBe("Window In Progress");
      expect(cd.isExpired).toBe(false);
    });

    it("shows expired state when EXPIRED or past end", () => {
      const cd = getAvailabilityCountdown(
        "EXPIRED",
        startUtc,
        endUtc,
        expiresUtc,
        new Date("2026-10-04T23:00:00.000Z"),
      );
      expect(cd.headline).toBe("Expired");
      expect(cd.isExpired).toBe(true);
    });

    it("shows cancelled state when CANCELLED", () => {
      const cd = getAvailabilityCountdown(
        "CANCELLED",
        startUtc,
        endUtc,
        expiresUtc,
        new Date("2026-10-04T12:00:00.000Z"),
      );
      expect(cd.headline).toBe("Window Cancelled");
      expect(cd.isExpired).toBe(true);
    });

    it("shows matched state when MATCHED", () => {
      const cd = getAvailabilityCountdown(
        "MATCHED",
        startUtc,
        endUtc,
        expiresUtc,
        new Date("2026-10-04T12:00:00.000Z"),
      );
      expect(cd.headline).toBe("Match Found");
      expect(cd.isExpired).toBe(false);
    });
  });
});
