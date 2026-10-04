import { describe, expect, it } from "vitest";
import type { Coordinates } from "@footconnect/shared";
import {
  checkRecommendationEligibility,
  haversineKm,
  isRecommendationEligible,
  overlapMinutes,
  scoreRecommendation,
  type EligibilityCandidate,
} from "./recommendation-score";

describe("haversineKm", () => {
  const algiersCenter: Coordinates = { lat: 36.7538, lng: 3.0588 };
  const hydra: Coordinates = { lat: 36.7441, lng: 3.0422 };
  const babEzzouar: Coordinates = { lat: 36.7167, lng: 3.1833 };
  const zeralda: Coordinates = { lat: 36.7136, lng: 2.8425 };
  const oran: Coordinates = { lat: 35.6971, lng: -0.6308 };

  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(algiersCenter, algiersCenter)).toBe(0);
    expect(haversineKm(hydra, { ...hydra })).toBe(0);
  });

  it("is symmetric regardless of argument order", () => {
    const d1 = haversineKm(algiersCenter, hydra);
    const d2 = haversineKm(hydra, algiersCenter);
    expect(d1).toBeCloseTo(d2, 8);
  });

  it("computes accurate distance for Algiers Center to Hydra (~1.8 km)", () => {
    const distance = haversineKm(algiersCenter, hydra);
    // ~1.83 km
    expect(distance).toBeGreaterThan(1.7);
    expect(distance).toBeLessThan(2.0);
  });

  it("computes accurate distance for Algiers Center to Bab Ezzouar (~11.8 km)", () => {
    const distance = haversineKm(algiersCenter, babEzzouar);
    expect(distance).toBeGreaterThan(11.0);
    expect(distance).toBeLessThan(12.5);
  });

  it("computes accurate distance for Hydra to Bab Ezzouar (~12.9 km)", () => {
    const distance = haversineKm(hydra, babEzzouar);
    expect(distance).toBeGreaterThan(12.5);
    expect(distance).toBeLessThan(13.5);
  });

  it("computes accurate distance for Algiers Center to Zeralda (~19.8 km)", () => {
    const distance = haversineKm(algiersCenter, zeralda);
    expect(distance).toBeGreaterThan(19.0);
    expect(distance).toBeLessThan(21.0);
  });

  it("computes intercity distance for Algiers to Oran (~350-360 km)", () => {
    const distance = haversineKm(algiersCenter, oran);
    expect(distance).toBeGreaterThan(345);
    expect(distance).toBeLessThan(365);
  });
});

describe("overlapMinutes", () => {
  it("returns full window duration for identical windows", () => {
    const start = new Date("2026-11-01T12:00:00Z");
    const end = new Date("2026-11-01T14:00:00Z");
    expect(overlapMinutes(start, end, start, end)).toBe(120);
  });

  it("returns partial overlap when window A starts before and ends inside window B", () => {
    const aStart = new Date("2026-11-01T12:00:00Z");
    const aEnd = new Date("2026-11-01T14:00:00Z");
    const bStart = new Date("2026-11-01T13:00:00Z");
    const bEnd = new Date("2026-11-01T15:00:00Z");
    expect(overlapMinutes(aStart, aEnd, bStart, bEnd)).toBe(60);
    expect(overlapMinutes(bStart, bEnd, aStart, aEnd)).toBe(60);
  });

  it("returns duration of inner window when one window encloses another", () => {
    const outerStart = new Date("2026-11-01T10:00:00Z");
    const outerEnd = new Date("2026-11-01T14:00:00Z");
    const innerStart = new Date("2026-11-01T11:00:00Z");
    const innerEnd = new Date("2026-11-01T12:30:00Z"); // 90 min
    expect(overlapMinutes(outerStart, outerEnd, innerStart, innerEnd)).toBe(90);
    expect(overlapMinutes(innerStart, innerEnd, outerStart, outerEnd)).toBe(90);
  });

  it("returns 0 for adjacent windows (touching boundaries do not overlap)", () => {
    const aStart = new Date("2026-11-01T10:00:00Z");
    const aEnd = new Date("2026-11-01T12:00:00Z");
    const bStart = new Date("2026-11-01T12:00:00Z");
    const bEnd = new Date("2026-11-01T14:00:00Z");
    expect(overlapMinutes(aStart, aEnd, bStart, bEnd)).toBe(0);
    expect(overlapMinutes(bStart, bEnd, aStart, aEnd)).toBe(0);
  });

  it("returns 0 for disjoint / non-overlapping windows", () => {
    const aStart = new Date("2026-11-01T10:00:00Z");
    const aEnd = new Date("2026-11-01T11:00:00Z");
    const bStart = new Date("2026-11-01T12:00:00Z");
    const bEnd = new Date("2026-11-01T13:00:00Z");
    expect(overlapMinutes(aStart, aEnd, bStart, bEnd)).toBe(0);
    expect(overlapMinutes(bStart, bEnd, aStart, aEnd)).toBe(0);
  });

  it("accepts ISO string dates and numeric millisecond timestamps", () => {
    const aStart = "2026-11-01T12:00:00Z";
    const aEnd = "2026-11-01T14:00:00Z";
    const bStart = Date.parse("2026-11-01T13:00:00Z");
    const bEnd = Date.parse("2026-11-01T15:00:00Z");
    expect(overlapMinutes(aStart, aEnd, bStart, bEnd)).toBe(60);
  });

  it("returns 0 when windows are inverted (end before start)", () => {
    const aStart = new Date("2026-11-01T14:00:00Z");
    const aEnd = new Date("2026-11-01T12:00:00Z");
    const bStart = new Date("2026-11-01T11:00:00Z");
    const bEnd = new Date("2026-11-01T13:00:00Z");
    expect(overlapMinutes(aStart, aEnd, bStart, bEnd)).toBe(0);
  });
});

describe("scoreRecommendation", () => {
  it("returns 100 for exact match (0 Elo difference, 0 km distance)", () => {
    const score = scoreRecommendation({
      eloDifference: 0,
      mutualEloTolerance: 150,
      distanceKm: 0,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(100);
  });

  it("returns 0 at the exact tolerance and radius boundaries", () => {
    // diff == tolerance (elo = 0), distance == radius (distance = 0)
    const score = scoreRecommendation({
      eloDifference: 150,
      mutualEloTolerance: 150,
      distanceKm: 10,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(0);
  });

  it("returns 35 at the exact Elo tolerance boundary when distance is 0", () => {
    // elo = 1 - 1 = 0 (weight 0.65 -> 0), distance = 1 - 0 = 1 (weight 0.35 -> 35)
    const score = scoreRecommendation({
      eloDifference: 150,
      mutualEloTolerance: 150,
      distanceKm: 0,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(35);
  });

  it("returns 65 at the exact radius boundary when Elo diff is 0", () => {
    // elo = 1 - 0 = 1 (weight 0.65 -> 65), distance = 1 - 1 = 0 (weight 0.35 -> 0)
    const score = scoreRecommendation({
      eloDifference: 0,
      mutualEloTolerance: 150,
      distanceKm: 10,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(65);
  });

  it("clamps components to 0 when exceeding tolerance or radius", () => {
    // diff exceeds tolerance (elo = 0), distance exceeds radius (distance = 0)
    const score = scoreRecommendation({
      eloDifference: 250,
      mutualEloTolerance: 150,
      distanceKm: 25,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(0);
  });

  it("computes accurate weighted intermediate score", () => {
    // diff = 75 / 150 -> elo = 0.5 (0.65 * 0.5 = 0.325)
    // distance = 5 / 10 -> dist = 0.5 (0.35 * 0.5 = 0.175)
    // sum = 0.50 -> 100 * 0.5 = 50
    const score = scoreRecommendation({
      eloDifference: 75,
      mutualEloTolerance: 150,
      distanceKm: 5,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(50);
  });

  it("handles negative eloDifference symmetrically using absolute difference", () => {
    const positive = scoreRecommendation({
      eloDifference: 75,
      mutualEloTolerance: 150,
      distanceKm: 5,
      mutualRadiusKm: 10,
    });
    const negative = scoreRecommendation({
      eloDifference: -75,
      mutualEloTolerance: 150,
      distanceKm: 5,
      mutualRadiusKm: 10,
    });
    expect(negative).toBe(positive);
    expect(negative).toBe(50);
  });

  it("rounds the final score to the nearest integer", () => {
    // elo = 1 - (40 / 150) = 1 - 0.266667 = 0.733333 -> 0.65 * 0.733333 = 0.476667
    // dist = 1 - (3 / 10) = 0.7 -> 0.35 * 0.7 = 0.245
    // total = 0.476667 + 0.245 = 0.721667 -> 72.1667 -> round = 72
    const score = scoreRecommendation({
      eloDifference: 40,
      mutualEloTolerance: 150,
      distanceKm: 3,
      mutualRadiusKm: 10,
    });
    expect(score).toBe(72);
  });

  it("does not accept or use reliability as a score input", () => {
    // Reliability is deliberately omitted from score inputs as per specification
    const input = {
      eloDifference: 0,
      mutualEloTolerance: 150,
      distanceKm: 0,
      mutualRadiusKm: 10,
    };
    // Passing any extraneous object does not alter the output
    const scoreWithExtra = scoreRecommendation({
      ...input,
      ...({ reliability: "NEW", reliabilityPercentage: 100 } as any),
    });
    expect(scoreWithExtra).toBe(100);
  });
});

describe("isRecommendationEligible & checkRecommendationEligibility", () => {
  const makeCandidate = (overrides?: {
    team?: Partial<EligibilityCandidate["team"]>;
    availability?: Partial<EligibilityCandidate["availability"]>;
  }): EligibilityCandidate => ({
    team: {
      id: "11111111-1111-4111-8111-111111111111",
      isActive: true,
      hasActiveCaptain: true,
      elo: 1200,
      ...overrides?.team,
    },
    availability: {
      status: "OPEN",
      format: "FIVE_A_SIDE",
      startAt: new Date("2026-11-01T12:00:00Z"),
      endAt: new Date("2026-11-01T14:00:00Z"),
      origin: { lat: 36.7538, lng: 3.0588 }, // Algiers Center
      radiusKm: 10,
      eloTolerance: 150,
      ...overrides?.availability,
    },
  });

  const baseA = makeCandidate({
    team: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", elo: 1200 },
    availability: {
      origin: { lat: 36.7538, lng: 3.0588 }, // Algiers Center
      radiusKm: 10,
      eloTolerance: 150,
    },
  });

  const baseB = makeCandidate({
    team: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", elo: 1250 },
    availability: {
      origin: { lat: 36.7441, lng: 3.0422 }, // Hydra (~1.83 km away)
      radiusKm: 10,
      eloTolerance: 150,
    },
  });

  it("returns eligible: true for valid matching candidates", () => {
    const result = checkRecommendationEligibility(baseA, baseB);
    expect(result.eligible).toBe(true);
    expect(isRecommendationEligible(baseA, baseB)).toBe(true);
  });

  it("rejects when candidate is the same team", () => {
    const sameTeam = makeCandidate({
      team: { id: baseA.team.id },
    });
    const result = checkRecommendationEligibility(baseA, sameTeam);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("SAME_TEAM");
    expect(isRecommendationEligible(baseA, sameTeam)).toBe(false);
  });

  it("rejects when either team is not active", () => {
    const inactiveA = makeCandidate({
      team: { id: baseA.team.id, isActive: false },
    });
    const resultA = checkRecommendationEligibility(inactiveA, baseB);
    expect(resultA.eligible).toBe(false);
    expect(resultA.reason).toBe("TEAM_INACTIVE");

    const inactiveB = makeCandidate({
      team: { id: baseB.team.id, isActive: false },
    });
    const resultB = checkRecommendationEligibility(baseA, inactiveB);
    expect(resultB.eligible).toBe(false);
    expect(resultB.reason).toBe("TEAM_INACTIVE");
  });

  it("rejects when either team does not have an active captain", () => {
    const noCapA = makeCandidate({
      team: { id: baseA.team.id, hasActiveCaptain: false },
    });
    const resultA = checkRecommendationEligibility(noCapA, baseB);
    expect(resultA.eligible).toBe(false);
    expect(resultA.reason).toBe("MISSING_CAPTAIN");

    const noCapB = makeCandidate({
      team: { id: baseB.team.id, hasActiveCaptain: false },
    });
    const resultB = checkRecommendationEligibility(baseA, noCapB);
    expect(resultB.eligible).toBe(false);
    expect(resultB.reason).toBe("MISSING_CAPTAIN");
  });

  it("rejects when either availability is not OPEN (e.g. MATCHED or CANCELLED)", () => {
    const matchedA = makeCandidate({
      team: { id: baseA.team.id },
      availability: { status: "MATCHED" },
    });
    const resultA = checkRecommendationEligibility(matchedA, baseB);
    expect(resultA.eligible).toBe(false);
    expect(resultA.reason).toBe("AVAILABILITY_NOT_OPEN");

    const cancelledB = makeCandidate({
      team: { id: baseB.team.id },
      availability: { status: "CANCELLED" },
    });
    const resultB = checkRecommendationEligibility(baseA, cancelledB);
    expect(resultB.eligible).toBe(false);
    expect(resultB.reason).toBe("AVAILABILITY_NOT_OPEN");
  });

  it("rejects when match format does not match exactly", () => {
    const formatB = makeCandidate({
      team: { id: baseB.team.id },
      availability: { format: "SEVEN_A_SIDE" },
    });
    const result = checkRecommendationEligibility(baseA, formatB);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("FORMAT_MISMATCH");
    expect(isRecommendationEligible(baseA, formatB)).toBe(false);
  });

  it("rejects when availability windows do not overlap", () => {
    const disjointB = makeCandidate({
      team: { id: baseB.team.id },
      availability: {
        startAt: new Date("2026-11-01T15:00:00Z"),
        endAt: new Date("2026-11-01T17:00:00Z"),
      },
    });
    const result = checkRecommendationEligibility(baseA, disjointB);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("NO_OVERLAP");
    expect(isRecommendationEligible(baseA, disjointB)).toBe(false);
  });

  it("rejects adjacent availability windows (overlap = 0 minutes)", () => {
    const adjacentB = makeCandidate({
      team: { id: baseB.team.id },
      availability: {
        startAt: new Date("2026-11-01T14:00:00Z"),
        endAt: new Date("2026-11-01T16:00:00Z"),
      },
    });
    const result = checkRecommendationEligibility(baseA, adjacentB);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("NO_OVERLAP");
  });

  it("accepts when distance is within mutual radius, rejects when exceeding", () => {
    // Algiers Center to Bab Ezzouar is ~11.83 km
    const babEzzouarCandidate = makeCandidate({
      team: { id: baseB.team.id },
      availability: {
        origin: { lat: 36.7167, lng: 3.1833 },
        radiusKm: 10, // Team B accepts 10 km
      },
    });

    // Case 1: Team A radius = 10 km -> mutual radius = 10 km -> 11.83 > 10 => Ineligible
    const res1 = checkRecommendationEligibility(baseA, babEzzouarCandidate);
    expect(res1.eligible).toBe(false);
    expect(res1.reason).toBe("DISTANCE_EXCEEDS_RADIUS");

    // Case 2: Team A radius = 15 km, but Team B radius = 10 km -> mutual radius = 10 km => still Ineligible
    const teamA15 = makeCandidate({
      team: { id: baseA.team.id },
      availability: { ...baseA.availability, radiusKm: 15 },
    });
    const res2 = checkRecommendationEligibility(teamA15, babEzzouarCandidate);
    expect(res2.eligible).toBe(false);
    expect(res2.reason).toBe("DISTANCE_EXCEEDS_RADIUS");

    // Case 3: Both teams set radius = 15 km -> mutual radius = 15 km -> 11.83 <= 15 => Eligible!
    const babEzzouarCandidate15 = makeCandidate({
      team: { id: baseB.team.id },
      availability: {
        origin: { lat: 36.7167, lng: 3.1833 },
        radiusKm: 15,
      },
    });
    const res3 = checkRecommendationEligibility(teamA15, babEzzouarCandidate15);
    expect(res3.eligible).toBe(true);
  });

  it("accepts exact radius boundary and rejects just beyond", () => {
    // Distance from origin to a point exactly 5.0 km away
    // Using simple test origin
    const origin1 = { lat: 0, lng: 0 };
    // At lat 0, 1 deg lng ≈ 111.3195 km -> 5km is roughly 0.04491576 deg
    const testA = makeCandidate({
      team: { id: "a" },
      availability: { origin: origin1, radiusKm: 5 },
    });

    // Exactly at or slightly within radius
    const testClose = makeCandidate({
      team: { id: "b" },
      availability: {
        origin: { lat: 0, lng: 0.0449 },
        radiusKm: 5,
      },
    });
    const dClose = haversineKm(origin1, testClose.availability.origin);
    expect(dClose).toBeLessThanOrEqual(5);
    expect(checkRecommendationEligibility(testA, testClose).eligible).toBe(true);

    // Beyond radius
    const testFar = makeCandidate({
      team: { id: "c" },
      availability: {
        origin: { lat: 0, lng: 0.046 },
        radiusKm: 5,
      },
    });
    const dFar = haversineKm(origin1, testFar.availability.origin);
    expect(dFar).toBeGreaterThan(5);
    const resFar = checkRecommendationEligibility(testA, testFar);
    expect(resFar.eligible).toBe(false);
    expect(resFar.reason).toBe("DISTANCE_EXCEEDS_RADIUS");
  });

  it("accepts when Elo difference is within mutual tolerance, rejects when exceeding", () => {
    // Team A elo = 1200, tol = 150
    // Team B elo = 1320 (diff = 120)
    // Case 1: Both tol = 150 -> mutual tol = 150 -> 120 <= 150 => Eligible
    const teamB120 = makeCandidate({
      team: { id: baseB.team.id, elo: 1320 },
      availability: { eloTolerance: 150 },
    });
    expect(checkRecommendationEligibility(baseA, teamB120).eligible).toBe(true);

    // Case 2: Team B tol = 100 -> mutual tol = min(150, 100) = 100 -> 120 > 100 => Ineligible
    const teamBStrict = makeCandidate({
      team: { id: baseB.team.id, elo: 1320 },
      availability: { eloTolerance: 100 },
    });
    const resStrict = checkRecommendationEligibility(baseA, teamBStrict);
    expect(resStrict.eligible).toBe(false);
    expect(resStrict.reason).toBe("ELO_DIFF_EXCEEDS_TOLERANCE");
  });

  it("accepts exact Elo tolerance boundary and rejects diff > tolerance", () => {
    // Team A elo = 1200, tol = 100
    // Exactly at tolerance boundary (diff = 100)
    const exactBoundary = makeCandidate({
      team: { id: baseB.team.id, elo: 1300 },
      availability: { eloTolerance: 100 },
    });
    const teamATol100 = makeCandidate({
      team: { id: baseA.team.id, elo: 1200 },
      availability: { eloTolerance: 100 },
    });
    expect(checkRecommendationEligibility(teamATol100, exactBoundary).eligible).toBe(true);

    // Just beyond tolerance boundary (diff = 101)
    const beyondBoundary = makeCandidate({
      team: { id: baseB.team.id, elo: 1301 },
      availability: { eloTolerance: 100 },
    });
    const resBeyond = checkRecommendationEligibility(teamATol100, beyondBoundary);
    expect(resBeyond.eligible).toBe(false);
    expect(resBeyond.reason).toBe("ELO_DIFF_EXCEEDS_TOLERANCE");
  });

  it("supports passing a single unified object with teamA, teamB, availabilityA, availabilityB", () => {
    const isEligible = isRecommendationEligible({
      teamA: baseA.team,
      availabilityA: baseA.availability,
      teamB: baseB.team,
      availabilityB: baseB.availability,
    });
    expect(isEligible).toBe(true);
  });
});
