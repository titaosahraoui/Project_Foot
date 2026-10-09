import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../middleware/error-handler";
import * as idempotency from "../../lib/idempotency";
import * as ratingsService from "../ratings/ratings.service";
import * as teamsService from "../teams/teams.service";
import * as repo from "./matchmaking.repository";
import { createChallenge } from "./matchmaking.service";

vi.mock("../teams/teams.service");
vi.mock("../ratings/ratings.service");
vi.mock("./matchmaking.repository");
vi.mock("../../lib/idempotency");
vi.mock("../../lib/transaction", () => ({
  withTransaction: vi.fn((cb) => cb({})),
}));

describe("createChallenge (unit)", () => {
  const actorId = randomUUID();
  const challengerTeamId = randomUUID();
  const opponentTeamId = randomUUID();
  const challengerAvailabilityId = randomUUID();
  const opponentAvailabilityId = randomUUID();

  const now = new Date("2026-10-06T10:00:00.000Z");
  const challengerStart = new Date("2026-10-06T18:00:00.000Z"); // 8h lead time
  const challengerEnd = new Date("2026-10-06T20:00:00.000Z");
  const opponentStart = new Date("2026-10-06T18:30:00.000Z");
  const opponentEnd = new Date("2026-10-06T20:30:00.000Z");

  const baseInput = {
    challengerAvailabilityId,
    opponentAvailabilityId,
    message: "Ready for a great match!",
  };

  const challengerAvail = {
    id: challengerAvailabilityId,
    teamId: challengerTeamId,
    createdById: actorId,
    startAt: challengerStart,
    endAt: challengerEnd,
    format: "FIVE_A_SIDE" as const,
    originLat: 36.7538,
    originLng: 3.0588,
    radiusKm: 10,
    eloTolerance: 150,
    message: null,
    status: "OPEN" as const,
    expiresAt: challengerStart,
    matchedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-10-05T12:00:00.000Z"),
    updatedAt: new Date("2026-10-05T12:00:00.000Z"),
  };

  const opponentAvail = {
    id: opponentAvailabilityId,
    teamId: opponentTeamId,
    createdById: "other-captain",
    startAt: opponentStart,
    endAt: opponentEnd,
    format: "FIVE_A_SIDE" as const,
    originLat: 36.755,
    originLng: 3.06,
    radiusKm: 10,
    eloTolerance: 150,
    message: null,
    status: "OPEN" as const,
    expiresAt: opponentStart,
    matchedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-10-05T12:00:00.000Z"),
    updatedAt: new Date("2026-10-05T12:00:00.000Z"),
  };

  const challengerTeam = {
    id: challengerTeamId,
    name: "Challenger FC",
    logoUrl: null,
    status: "ACTIVE",
    members: [{ userId: actorId, teamRole: "CAPTAIN" as const }],
  };

  const opponentTeam = {
    id: opponentTeamId,
    name: "Opponent FC",
    logoUrl: null,
    status: "ACTIVE",
    members: [{ userId: "other-captain", teamRole: "CAPTAIN" as const }],
  };

  const createdChallengeId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findAvailabilityById).mockReset();
    vi.mocked(idempotency.readIdempotentResult).mockResolvedValue(null);
    vi.mocked(idempotency.hashIdempotencyRequest).mockReturnValue("mock-hash");
    vi.mocked(teamsService.assertActiveCaptain).mockResolvedValue({} as any);
    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) return challengerAvail as any;
      if (id === opponentAvailabilityId) return opponentAvail as any;
      return null;
    });
    vi.mocked(teamsService.getTeam).mockImplementation(async (id) => {
      if (id === challengerTeamId) return challengerTeam as any;
      if (id === opponentTeamId) return opponentTeam as any;
      throw new Error("Unknown team");
    });
    vi.mocked(ratingsService.getTeamRating).mockResolvedValue({
      rating: 1000,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    });
    vi.mocked(repo.acquireTeamAvailabilityLock).mockResolvedValue(undefined);
    vi.mocked(repo.findPendingChallengeByAvailabilities).mockResolvedValue(null);
    vi.mocked(repo.createChallenge).mockImplementation(async (data) => ({
      id: createdChallengeId,
      ...data,
      bookingDeadline: null,
      respondedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    } as any));
  });

  it("successfully creates a challenge with canonical overlap snapshot and responseDeadline", async () => {
    const result = await createChallenge(actorId, baseInput, now);

    expect(result.id).toBe(createdChallengeId);
    expect(result.status).toBe("PENDING");
    expect(result.format).toBe("FIVE_A_SIDE");
    expect(result.startAt).toBe("2026-10-06T18:30:00.000Z"); // max(start)
    expect(result.endAt).toBe("2026-10-06T20:00:00.000Z"); // min(end)
    expect(result.bookingDeadline).toBeNull();
    expect(result.message).toBe("Ready for a great match!");

    // Response deadline: min(now + 24h, start - 4h)
    // now + 24h = Oct 7 10:00, start - 4h = Oct 6 14:30. Earlier is start - 4h
    expect(result.responseDeadline).toBe("2026-10-06T14:30:00.000Z");

    // Proves availability update was NOT called on send
    expect(repo.updateAvailability).not.toHaveBeenCalled();
    expect(idempotency.storeIdempotentResult).toHaveBeenCalled();
  });

  it("returns cached result on idempotent retry with matching payload", async () => {
    const cachedResponse = {
      id: "cached-challenge-id",
      status: "PENDING" as const,
    };
    vi.mocked(idempotency.readIdempotentResult).mockResolvedValue({
      requestHash: "mock-hash",
      resourceType: "MatchChallenge",
      resourceId: "cached-challenge-id",
      responseStatus: 201,
      responseBody: cachedResponse as any,
    });

    const result = await createChallenge(actorId, baseInput, now);
    expect(result).toEqual(cachedResponse);
    expect(repo.createChallenge).not.toHaveBeenCalled();
  });

  it("throws 409 conflict when idempotency key is reused with different request payload", async () => {
    vi.mocked(idempotency.readIdempotentResult).mockResolvedValue({
      requestHash: "different-hash",
      resourceType: "MatchChallenge",
      resourceId: "cached-challenge-id",
      responseStatus: 201,
      responseBody: {} as any,
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("throws 404 when availability row is not found", async () => {
    vi.mocked(repo.findAvailabilityById).mockResolvedValue(null);

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 403 when actor does not captain the challenger team", async () => {
    vi.mocked(teamsService.assertActiveCaptain).mockRejectedValueOnce(
      new HttpError(403, "Forbidden"),
    );

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws 422 on self-challenge (same team)", async () => {
    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) return challengerAvail as any;
      if (id === opponentAvailabilityId)
        return { ...opponentAvail, teamId: challengerTeamId } as any;
      return null;
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
  });

  it("throws 409 when either availability window is not OPEN", async () => {
    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) return challengerAvail as any;
      if (id === opponentAvailabilityId)
        return { ...opponentAvail, status: "MATCHED" } as any;
      return null;
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("throws 409 when availability window has expired", async () => {
    const expiredTime = new Date("2026-10-06T21:00:00.000Z"); // past endAt

    await expect(createChallenge(actorId, baseInput, expiredTime)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("reloads both locked availability rows before creating a challenge", async () => {
    const closedOpponent = { ...opponentAvail, status: "MATCHED" as const };
    vi.mocked(repo.findAvailabilityById).mockReset();
    vi.mocked(repo.findAvailabilityById)
      .mockImplementationOnce(async () => challengerAvail as any)
      .mockImplementationOnce(async () => opponentAvail as any)
      .mockImplementationOnce(async () => challengerAvail as any)
      .mockImplementationOnce(async () => closedOpponent as any);

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    expect(repo.createChallenge).not.toHaveBeenCalled();
  });

  it("rejects a challenge whose calculated response deadline has already passed", async () => {
    const nearStart = new Date("2026-10-06T13:00:00.000Z");
    const nearEnd = new Date("2026-10-06T15:00:00.000Z");
    vi.mocked(repo.findAvailabilityById).mockReset();
    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) {
        return { ...challengerAvail, startAt: nearStart, endAt: nearEnd, expiresAt: nearStart } as any;
      }
      if (id === opponentAvailabilityId) {
        return { ...opponentAvail, startAt: nearStart, endAt: nearEnd, expiresAt: nearStart } as any;
      }
      return null;
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
    expect(repo.createChallenge).not.toHaveBeenCalled();
  });

  it("throws 422 when opponent team has no active captain", async () => {
    vi.mocked(teamsService.getTeam).mockImplementation(async (id) => {
      if (id === challengerTeamId) return challengerTeam as any;
      if (id === opponentTeamId)
        return { ...opponentTeam, members: [{ userId: "m1", teamRole: "MEMBER" }] } as any;
      throw new Error("Unknown team");
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
  });

  it("throws 422 when match format is incompatible", async () => {
    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) return challengerAvail as any;
      if (id === opponentAvailabilityId)
        return { ...opponentAvail, format: "SEVEN_A_SIDE" } as any;
      return null;
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
  });

  it("throws 422 when windows do not overlap", async () => {
    // Non-overlapping times: 21:00-23:00 vs challenger 18:00-20:00
    const nonOverlappingOpponentAvail = {
      ...opponentAvail,
      startAt: new Date("2026-10-06T21:00:00.000Z"),
      endAt: new Date("2026-10-06T23:00:00.000Z"),
    };
    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) return challengerAvail as any;
      if (id === opponentAvailabilityId)
        return nonOverlappingOpponentAvail as any;
      return null;
    });

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 422,
      code: "CONDITIONS_VIOLATION",
    });
  });

  it("throws 409 when an active PENDING challenge already exists for the availability pair", async () => {
    vi.mocked(repo.findPendingChallengeByAvailabilities).mockResolvedValue({
      id: "existing-pending-challenge",
    } as any);

    await expect(createChallenge(actorId, baseInput, now)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});
