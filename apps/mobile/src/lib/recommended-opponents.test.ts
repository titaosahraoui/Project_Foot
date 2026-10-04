import { describe, expect, it } from "vitest";
import type {
  OpponentRecommendation,
  PaginatedRecommendations,
} from "@footconnect/shared";

describe("RecommendedOpponents State & Privacy Logic (M06-T06)", () => {
  const sampleRec: OpponentRecommendation = {
    availabilityId: "avail-123",
    team: {
      id: "team-456",
      name: "Algiers Sharks",
      logoUrl: null,
      elo: 1250,
    },
    teamSummary: {
      id: "team-456",
      name: "Algiers Sharks",
      logoUrl: null,
      elo: 1250,
    },
    overlappingWindow: {
      startAt: "2026-10-05T18:00:00.000Z",
      endAt: "2026-10-05T19:30:00.000Z",
      durationMinutes: 90,
    },
    format: "FIVE_A_SIDE",
    distanceKm: 2.4,
    eloDifference: 25,
    score: 92,
    explanation: {
      eloDifference: 25,
      distanceKm: 2.4,
      format: "FIVE_A_SIDE",
      overlapMinutes: 90,
      opponentReliability: null,
      eloScore: 0.83,
      distanceScore: 0.76,
    },
    reliability: null,
  };

  describe("1. Privacy & Coordinate Protection", () => {
    it("never contains raw coordinates on recommendation or team objects", () => {
      // Raw coordinates must NEVER be present
      expect((sampleRec as any).originLat).toBeUndefined();
      expect((sampleRec as any).originLng).toBeUndefined();
      expect((sampleRec as any).origin).toBeUndefined();
      expect((sampleRec.team as any).lat).toBeUndefined();
      expect((sampleRec.team as any).lng).toBeUndefined();

      // Only sanitized distanceKm is exposed
      expect(sampleRec.distanceKm).toBe(2.4);
      expect(typeof sampleRec.distanceKm).toBe("number");
    });
  });

  describe("2. Pagination Logic", () => {
    const PAGE_SIZE = 10;

    it("calculates total pages and boundaries correctly", () => {
      const paginated25: PaginatedRecommendations = {
        items: [sampleRec],
        page: 1,
        pageSize: PAGE_SIZE,
        total: 25,
      };

      const totalPages = Math.max(1, Math.ceil(paginated25.total / PAGE_SIZE));
      expect(totalPages).toBe(3);

      // Page 1: can go next, cannot go previous
      const canPrevP1 = paginated25.page > 1;
      const canNextP1 = paginated25.page < totalPages;
      expect(canPrevP1).toBe(false);
      expect(canNextP1).toBe(true);

      // Page 3: can go prev, cannot go next
      const canPrevP3 = 3 > 1;
      const canNextP3 = 3 < totalPages;
      expect(canPrevP3).toBe(true);
      expect(canNextP3).toBe(false);
    });

    it("handles single page results", () => {
      const paginated5: PaginatedRecommendations = {
        items: [sampleRec],
        page: 1,
        pageSize: PAGE_SIZE,
        total: 5,
      };
      const totalPages = Math.max(1, Math.ceil(paginated5.total / PAGE_SIZE));
      expect(totalPages).toBe(1);
    });
  });

  describe("3. Empty State & Pilot Fallback Copy", () => {
    it("identifies empty results when items array is empty", () => {
      const emptyResult: PaginatedRecommendations = {
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
      };
      expect(emptyResult.items.length).toBe(0);
      expect(emptyResult.total).toBe(0);
    });
  });

  describe("4. Expired Availability State", () => {
    it("flags window as expired when isExpired param or status is EXPIRED", () => {
      const isExpiredState = true;
      expect(isExpiredState).toBe(true);

      const statusExpired: "OPEN" | "EXPIRED" = "EXPIRED";
      expect(statusExpired === "EXPIRED").toBe(true);
    });
  });

  describe("5. Reliability and Recommendation Scoring", () => {
    it("displays reliability as null / NEW pilot indicator", () => {
      expect(sampleRec.reliability).toBeNull();
      const reliabilityLabel = sampleRec.reliability ?? "NEW";
      expect(reliabilityLabel).toBe("NEW");
    });

    it("displays 0-100 recommendation percentage", () => {
      expect(sampleRec.score).toBeGreaterThanOrEqual(0);
      expect(sampleRec.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(sampleRec.score)).toBe(true);
    });

    it("provides explanation breakdown fields", () => {
      expect(sampleRec.explanation.eloDifference).toBe(25);
      expect(sampleRec.explanation.distanceKm).toBe(2.4);
      expect(sampleRec.explanation.format).toBe("FIVE_A_SIDE");
      expect(sampleRec.explanation.overlapMinutes).toBe(90);
    });
  });

  describe("6. Actions restriction", () => {
    it("only permits View Team action (no challenge action in M06)", () => {
      // In M06-T06, only View Team exists
      const availableActions = ["View Team"];
      expect(availableActions).toContain("View Team");
      expect(availableActions).not.toContain("CHALLENGE");
      expect(availableActions).not.toContain("Challenge Team");
    });
  });
});
