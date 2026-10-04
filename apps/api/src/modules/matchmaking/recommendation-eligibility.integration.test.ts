import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { signAccessToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  disconnectTestDependencies,
  uniqueEmail,
} from "../../test/integration-helpers";
import * as ratingsService from "../ratings/ratings.service";
import * as teamsService from "../teams/teams.service";
import { getRecommendations } from "./matchmaking.service";

const app = createApp();

const password = "password123";
const HOUR_MS = 60 * 60 * 1000;
const BASE_TIME = Date.now() + 100 * HOUR_MS; // far enough in the future to avoid expiry

// Coordinates in Algiers area
const COORD_HYDRA = { lat: 36.7441, lng: 3.0422 };
const COORD_ALGIERS_CENTER = { lat: 36.7538, lng: 3.0588 }; // ~1.83 km from Hydra
const COORD_BAB_EZZOUAR = { lat: 36.7167, lng: 3.1833 }; // ~12.95 km from Hydra

// Teams and Tokens
let captainSearchToken = "";
let captainSearchId = "";
let searchTeamId = "";
let searchAvailabilityId = "";

let eligibleTeamId = "";
let eligibleAvailabilityId = "";

let inactiveTeamId = "";
let missingCaptainTeamId = "";
let nonOverlapTeamId = "";
let formatMismatchTeamId = "";
let radiusExceededTeamId = "";
let eloExceededTeamId = "";
let matchedStateTeamId = "";

let tieTeamAlphaId = "";
let tieTeamBetaId = "";

beforeAll(async () => {
  // 1. Search Team (Hydra, FIVE_A_SIDE, radius 10 km, eloTolerance 150, rating 1200, active captain)
  const uSearch = await prisma.user.create({
    data: { email: uniqueEmail("searchCap"), passwordHash: password, displayName: "Captain Search" },
  });
  captainSearchId = uSearch.id;
  captainSearchToken = signAccessToken({ userId: captainSearchId, roles: ["PLAYER"] });

  const tSearch = await prisma.team.create({
    data: {
      name: `Search Team Hydra ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: captainSearchId, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  searchTeamId = tSearch.id;

  const aSearch = await prisma.teamAvailability.create({
    data: {
      teamId: searchTeamId,
      createdById: captainSearchId,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_HYDRA.lat,
      originLng: COORD_HYDRA.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });
  searchAvailabilityId = aSearch.id;

  // Search team's OWN additional availability (to prove exclusion for own team at another non-overlapping time)
  await prisma.teamAvailability.create({
    data: {
      teamId: searchTeamId,
      createdById: captainSearchId,
      startAt: new Date(BASE_TIME + 10 * HOUR_MS),
      endAt: new Date(BASE_TIME + 12 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_HYDRA.lat,
      originLng: COORD_HYDRA.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME + 10 * HOUR_MS),
    },
  });

  // 2. Candidate Team 1: ELIGIBLE (Algiers Center ~1.83 km, FIVE_A_SIDE, rating 1220, active captain)
  const uEligible = await prisma.user.create({
    data: { email: uniqueEmail("eligibleCap"), passwordHash: password, displayName: "Captain Eligible" },
  });

  const tEligible = await prisma.team.create({
    data: {
      name: `Eligible Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1220 } },
      members: { create: { userId: uEligible.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  eligibleTeamId = tEligible.id;

  const aEligible = await prisma.teamAvailability.create({
    data: {
      teamId: eligibleTeamId,
      createdById: uEligible.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });
  eligibleAvailabilityId = aEligible.id;

  // 3. Candidate Team 2: EXCLUDED - Inactive Team (status: ARCHIVED)
  const uInactive = await prisma.user.create({
    data: { email: uniqueEmail("inactiveCap"), passwordHash: password, displayName: "Captain Inactive" },
  });
  const tInactive = await prisma.team.create({
    data: {
      name: `Inactive Team ${randomUUID().slice(0, 8)}`,
      status: "ARCHIVED",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: uInactive.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  inactiveTeamId = tInactive.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: inactiveTeamId,
      createdById: uInactive.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });

  // 4. Candidate Team 3: EXCLUDED - Missing Captain (has only MEMBER, no CAPTAIN)
  const uMember = await prisma.user.create({
    data: { email: uniqueEmail("onlyMem"), passwordHash: password, displayName: "Only Member" },
  });
  const tMissingCaptain = await prisma.team.create({
    data: {
      name: `No Captain Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: uMember.id, role: "MEMBER", status: "ACTIVE" } },
    },
  });
  missingCaptainTeamId = tMissingCaptain.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: missingCaptainTeamId,
      createdById: uMember.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });

  // 5. Candidate Team 4: EXCLUDED - Non-overlap (window +20h later, no overlap)
  const uNonOverlap = await prisma.user.create({
    data: { email: uniqueEmail("nonOverlapCap"), passwordHash: password, displayName: "Captain NonOverlap" },
  });
  const tNonOverlap = await prisma.team.create({
    data: {
      name: `Non Overlap Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: uNonOverlap.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  nonOverlapTeamId = tNonOverlap.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: nonOverlapTeamId,
      createdById: uNonOverlap.id,
      startAt: new Date(BASE_TIME + 20 * HOUR_MS),
      endAt: new Date(BASE_TIME + 22 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME + 20 * HOUR_MS),
    },
  });

  // 6. Candidate Team 5: EXCLUDED - Format Mismatch (SEVEN_A_SIDE vs FIVE_A_SIDE)
  const uFormatMismatch = await prisma.user.create({
    data: { email: uniqueEmail("formatCap"), passwordHash: password, displayName: "Captain Format" },
  });
  const tFormatMismatch = await prisma.team.create({
    data: {
      name: `Format Mismatch Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: uFormatMismatch.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  formatMismatchTeamId = tFormatMismatch.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: formatMismatchTeamId,
      createdById: uFormatMismatch.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "SEVEN_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });

  // 7. Candidate Team 6: EXCLUDED - Radius Exceeded (Bab Ezzouar ~12.95 km vs 10 km radius)
  const uRadius = await prisma.user.create({
    data: { email: uniqueEmail("radiusCap"), passwordHash: password, displayName: "Captain Radius" },
  });
  const tRadius = await prisma.team.create({
    data: {
      name: `Radius Exceeded Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: uRadius.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  radiusExceededTeamId = tRadius.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: radiusExceededTeamId,
      createdById: uRadius.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_BAB_EZZOUAR.lat,
      originLng: COORD_BAB_EZZOUAR.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });

  // 8. Candidate Team 7: EXCLUDED - Elo Tolerance Exceeded (Rating 1600: diff 400 > 150)
  const uElo = await prisma.user.create({
    data: { email: uniqueEmail("eloCap"), passwordHash: password, displayName: "Captain Elo" },
  });
  const tElo = await prisma.team.create({
    data: {
      name: `Elo Exceeded Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1600 } },
      members: { create: { userId: uElo.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  eloExceededTeamId = tElo.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: eloExceededTeamId,
      createdById: uElo.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "OPEN",
      expiresAt: new Date(BASE_TIME),
    },
  });

  // 9. Candidate Team 8: EXCLUDED - Already MATCHED State (status: MATCHED)
  const uMatched = await prisma.user.create({
    data: { email: uniqueEmail("matchedCap"), passwordHash: password, displayName: "Captain Matched" },
  });
  const tMatched = await prisma.team.create({
    data: {
      name: `Matched State Team ${randomUUID().slice(0, 8)}`,
      status: "ACTIVE",
      rating: { create: { rating: 1200 } },
      members: { create: { userId: uMatched.id, role: "CAPTAIN", status: "ACTIVE" } },
    },
  });
  matchedStateTeamId = tMatched.id;

  await prisma.teamAvailability.create({
    data: {
      teamId: matchedStateTeamId,
      createdById: uMatched.id,
      startAt: new Date(BASE_TIME),
      endAt: new Date(BASE_TIME + 2 * HOUR_MS),
      format: "FIVE_A_SIDE",
      originLat: COORD_ALGIERS_CENTER.lat,
      originLng: COORD_ALGIERS_CENTER.lng,
      radiusKm: 10,
      eloTolerance: 150,
      status: "MATCHED",
      matchedAt: new Date(),
      expiresAt: new Date(BASE_TIME),
    },
  });
}, 60000);

afterAll(async () => {
  await disconnectTestDependencies();
});

describe("M06-T07: Recommendation Eligibility Exclusions (at least 6 teams)", () => {
  it("proves exclusion for own team", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(searchTeamId);
  });

  it("proves exclusion for inactive team", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(inactiveTeamId);
  });

  it("proves exclusion for missing captain", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(missingCaptainTeamId);
  });

  it("proves exclusion for non-overlap", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(nonOverlapTeamId);
  });

  it("proves exclusion for format mismatch", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(formatMismatchTeamId);
  });

  it("proves exclusion for radius", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(radiusExceededTeamId);
  });

  it("proves exclusion for Elo tolerance", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(eloExceededTeamId);
  });

  it("proves exclusion for already MATCHED state", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).not.toContain(matchedStateTeamId);
  });

  it("retains only eligible candidates in the recommendation list", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const candidateTeamIds = res.body.items.map((i: any) => i.team.id);
    expect(candidateTeamIds).toContain(eligibleTeamId);

    const eligibleItem = res.body.items.find((i: any) => i.team.id === eligibleTeamId);
    expect(eligibleItem).toBeDefined();
    expect(eligibleItem.availabilityId).toBe(eligibleAvailabilityId);
    expect(eligibleItem.format).toBe("FIVE_A_SIDE");
    expect(eligibleItem.distanceKm).toBeGreaterThan(0);
    expect(eligibleItem.distanceKm).toBeLessThan(10);
    expect(eligibleItem.score).toBeGreaterThan(0);
    expect(eligibleItem.reliability).toBeNull();
  });
});

describe("M06-T07: Deterministic ranking for ties", () => {
  beforeAll(async () => {
    // Create two teams with identical rating (1200) and identical origin (Hydra)
    // so both score and distance are identical
    const uTieAlpha = await prisma.user.create({
      data: { email: uniqueEmail("tieAlpha"), passwordHash: password, displayName: "Captain Tie Alpha" },
    });
    const tTieAlpha = await prisma.team.create({
      data: {
        name: `Tie Alpha ${randomUUID().slice(0, 8)}`,
        status: "ACTIVE",
        rating: { create: { rating: 1200 } },
        members: { create: { userId: uTieAlpha.id, role: "CAPTAIN", status: "ACTIVE" } },
      },
    });
    tieTeamAlphaId = tTieAlpha.id;

    await prisma.teamAvailability.create({
      data: {
        teamId: tieTeamAlphaId,
        createdById: uTieAlpha.id,
        startAt: new Date(BASE_TIME),
        endAt: new Date(BASE_TIME + 2 * HOUR_MS),
        format: "FIVE_A_SIDE",
        originLat: COORD_HYDRA.lat,
        originLng: COORD_HYDRA.lng,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(BASE_TIME),
      },
    });

    const uTieBeta = await prisma.user.create({
      data: { email: uniqueEmail("tieBeta"), passwordHash: password, displayName: "Captain Tie Beta" },
    });
    const tTieBeta = await prisma.team.create({
      data: {
        name: `Tie Beta ${randomUUID().slice(0, 8)}`,
        status: "ACTIVE",
        rating: { create: { rating: 1200 } },
        members: { create: { userId: uTieBeta.id, role: "CAPTAIN", status: "ACTIVE" } },
      },
    });
    tieTeamBetaId = tTieBeta.id;

    await prisma.teamAvailability.create({
      data: {
        teamId: tieTeamBetaId,
        createdById: uTieBeta.id,
        startAt: new Date(BASE_TIME),
        endAt: new Date(BASE_TIME + 2 * HOUR_MS),
        format: "FIVE_A_SIDE",
        originLat: COORD_HYDRA.lat,
        originLng: COORD_HYDRA.lng,
        radiusKm: 10,
        eloTolerance: 150,
        status: "OPEN",
        expiresAt: new Date(BASE_TIME),
      },
    });
  }, 30000);

  it("breaks score and distance ties deterministically using team ID ascending (localeCompare)", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);

    const alphaItem = res.body.items.find((i: any) => i.team.id === tieTeamAlphaId);
    const betaItem = res.body.items.find((i: any) => i.team.id === tieTeamBetaId);

    expect(alphaItem).toBeDefined();
    expect(betaItem).toBeDefined();

    // Both have identical score (100) and distance (0 km)
    expect(alphaItem.score).toBe(100);
    expect(betaItem.score).toBe(100);
    expect(alphaItem.distanceKm).toBe(0);
    expect(betaItem.distanceKm).toBe(0);

    const alphaIndex = res.body.items.findIndex((i: any) => i.team.id === tieTeamAlphaId);
    const betaIndex = res.body.items.findIndex((i: any) => i.team.id === tieTeamBetaId);

    if (tieTeamAlphaId.localeCompare(tieTeamBetaId) < 0) {
      expect(alphaIndex).toBeLessThan(betaIndex);
    } else {
      expect(betaIndex).toBeLessThan(alphaIndex);
    }
  });

  it("prioritizes score descending, then distance ascending before breaking ties by team ID", async () => {
    const res = await request(app)
      .get(`/api/v1/matchmaking/availability/${searchAvailabilityId}/recommendations`)
      .set(authHeader(captainSearchToken));

    expect(res.status).toBe(200);
    const items = res.body.items;

    for (let i = 0; i < items.length - 1; i++) {
      const current = items[i];
      const next = items[i + 1];

      if (current.score !== next.score) {
        expect(current.score).toBeGreaterThan(next.score);
      } else if (current.distanceKm !== next.distanceKm) {
        expect(current.distanceKm).toBeLessThan(next.distanceKm);
      } else {
        expect(current.team.id.localeCompare(next.team.id)).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe("M06-T07: Repository Query Count Optimization", () => {
  it("proves query count does not grow once per candidate team and uses batch methods", async () => {
    // Spies on service and batch methods
    const spyGetTeamRatingsBatch = vi.spyOn(ratingsService, "getTeamRatingsBatch");
    const spyGetTeamsBatch = vi.spyOn(teamsService, "getTeamsBatch");
    const spyGetTeamRating = vi.spyOn(ratingsService, "getTeamRating");
    const spyGetTeam = vi.spyOn(teamsService, "getTeam");

    // Call getRecommendations directly
    const result = await getRecommendations(captainSearchId, searchAvailabilityId);

    expect(result.items.length).toBeGreaterThan(0);

    // 1. Searching team's individual rating and team detail are retrieved for searching team only
    expect(spyGetTeam).toHaveBeenCalledTimes(1);
    expect(spyGetTeam).toHaveBeenCalledWith(searchTeamId);

    // Any calls to getTeamRating are exclusively for the searching team, never for candidates
    for (const call of spyGetTeamRating.mock.calls) {
      expect(call[0]).toBe(searchTeamId);
    }
    for (const call of spyGetTeam.mock.calls) {
      expect(call[0]).toBe(searchTeamId);
    }

    // 2. Candidate teams are retrieved in batch, NOT via per-candidate getTeamRating or getTeam calls!
    // No candidate team ID was ever queried individually
    const candidateIds = [
      eligibleTeamId,
      inactiveTeamId,
      missingCaptainTeamId,
      formatMismatchTeamId,
      radiusExceededTeamId,
      eloExceededTeamId,
      tieTeamAlphaId,
      tieTeamBetaId,
    ];
    for (const id of candidateIds) {
      expect(spyGetTeamRating).not.toHaveBeenCalledWith(id, expect.anything());
      expect(spyGetTeam).not.toHaveBeenCalledWith(id);
    }

    // 3. Batch retrieval functions were used for candidate teams (O(1) batch query)
    expect(spyGetTeamsBatch).toHaveBeenCalledTimes(1);
    expect(spyGetTeamRatingsBatch).toHaveBeenCalled();

    // Verify the arguments passed to batch functions contain all candidates
    const calledCandidateIds = spyGetTeamsBatch.mock.calls[0]?.[0] ?? [];
    expect(calledCandidateIds.length).toBeGreaterThan(1);
    expect(calledCandidateIds).toContain(eligibleTeamId);

    spyGetTeamRatingsBatch.mockRestore();
    spyGetTeamsBatch.mockRestore();
    spyGetTeamRating.mockRestore();
    spyGetTeam.mockRestore();
  });
});
