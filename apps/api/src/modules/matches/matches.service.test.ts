import { describe, expect, it, vi, beforeEach } from "vitest";
import { HttpError } from "../../middleware/error-handler";
import * as repo from "./matches.repository";
import * as matchesService from "./matches.service";
import * as teamsService from "../teams/teams.service";

vi.mock("../../lib/transaction", () => ({
  withTransaction: vi.fn((cb) => cb({})),
}));

describe("matches.service (unit)", () => {
  const dummyMatch = {
    id: "match-123",
    bookingId: "booking-123",
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    homeCaptainId: "cap-home",
    awayCaptainId: "cap-away",
    pitchOwnerId: "owner-1",
    startAt: new Date("2026-11-20T18:00:00.000Z"),
    endAt: new Date("2026-11-20T19:30:00.000Z"),
    format: "FIVE_A_SIDE" as const,
    status: "SCHEDULED" as const,
    createdAt: new Date("2026-10-10T12:00:00.000Z"),
    updatedAt: new Date("2026-10-10T12:00:00.000Z"),
    participants: [
      {
        id: "part-1",
        matchId: "match-123",
        teamId: "team-home",
        captainId: "cap-home",
        role: "HOME" as const,
        createdAt: new Date("2026-10-10T12:00:00.000Z"),
      },
      {
        id: "part-2",
        matchId: "match-123",
        teamId: "team-away",
        captainId: "cap-away",
        role: "AWAY" as const,
        createdAt: new Date("2026-10-10T12:00:00.000Z"),
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns existing match on idempotent retry without calling createScheduledMatch", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(dummyMatch);
    const createSpy = vi.spyOn(repo, "createScheduledMatch");

    const result = await matchesService.scheduleFromConfirmedBooking({
      bookingId: "booking-123",
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      pitchOwnerId: "owner-1",
      startAt: new Date("2026-11-20T18:00:00.000Z"),
      endAt: new Date("2026-11-20T19:30:00.000Z"),
      format: "FIVE_A_SIDE",
    });

    expect(result.id).toBe("match-123");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("snapshots active captain IDs from teamsService if captain IDs are not provided", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(null);
    vi.spyOn(teamsService, "getActiveCaptainId")
      .mockResolvedValueOnce("cap-home")
      .mockResolvedValueOnce("cap-away");
    const createSpy = vi
      .spyOn(repo, "createScheduledMatch")
      .mockResolvedValueOnce(dummyMatch);

    const result = await matchesService.scheduleFromConfirmedBooking({
      bookingId: "booking-123",
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      pitchOwnerId: "owner-1",
      startAt: new Date("2026-11-20T18:00:00.000Z"),
      endAt: new Date("2026-11-20T19:30:00.000Z"),
      format: "FIVE_A_SIDE",
    });

    expect(teamsService.getActiveCaptainId).toHaveBeenCalledWith("team-home", undefined);
    expect(teamsService.getActiveCaptainId).toHaveBeenCalledWith("team-away", undefined);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        homeCaptainId: "cap-home",
        awayCaptainId: "cap-away",
        participants: [
          { teamId: "team-home", captainId: "cap-home", role: "HOME" },
          { teamId: "team-away", captainId: "cap-away", role: "AWAY" },
        ],
      }),
      undefined,
    );
    expect(result.id).toBe("match-123");
  });

  it("uses explicitly provided captain IDs without calling teamsService", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(null);
    const getCapSpy = vi.spyOn(teamsService, "getActiveCaptainId");
    const createSpy = vi
      .spyOn(repo, "createScheduledMatch")
      .mockResolvedValueOnce(dummyMatch);

    await matchesService.scheduleFromConfirmedBooking({
      bookingId: "booking-123",
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      homeCaptainId: "cap-custom-1",
      awayCaptainId: "cap-custom-2",
      pitchOwnerId: "owner-1",
      startAt: new Date("2026-11-20T18:00:00.000Z"),
      endAt: new Date("2026-11-20T19:30:00.000Z"),
      format: "FIVE_A_SIDE",
    });

    expect(getCapSpy).not.toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        homeCaptainId: "cap-custom-1",
        awayCaptainId: "cap-custom-2",
      }),
      undefined,
    );
  });

  it("getMatchByBookingId returns null when no match exists", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(null);

    const result = await matchesService.getMatchByBookingId("unknown-booking");
    expect(result).toBeNull();
  });

  it("getMatchByBookingId returns mapped match summary when match exists", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(dummyMatch);

    const result = await matchesService.getMatchByBookingId("booking-123");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("match-123");
    expect(result?.participants).toHaveLength(2);
  });
});

describe("submitMatchLineup & replaceMatchLineup (M09-T02 unit)", () => {
  const matchId = "match-456";
  const homeTeamId = "team-home";
  const awayTeamId = "team-away";
  const homeCaptainId = "cap-home";
  const awayCaptainId = "cap-away";
  const outsiderId = "user-outsider";

  const matchStartTime = new Date("2026-11-20T18:00:00.000Z");
  const beforeStart = new Date("2026-11-20T17:00:00.000Z");
  const afterStart = new Date("2026-11-20T18:05:00.000Z");

  const matchFixture = {
    id: matchId,
    bookingId: "booking-456",
    homeTeamId,
    awayTeamId,
    homeCaptainId,
    awayCaptainId,
    pitchOwnerId: "owner-1",
    startAt: matchStartTime,
    endAt: new Date("2026-11-20T19:30:00.000Z"),
    format: "FIVE_A_SIDE" as const,
    status: "SCHEDULED" as const,
    createdAt: new Date("2026-10-10T12:00:00.000Z"),
    updatedAt: new Date("2026-10-10T12:00:00.000Z"),
    participants: [
      { id: "p-1", matchId, teamId: homeTeamId, captainId: homeCaptainId, role: "HOME" as const, createdAt: new Date() },
      { id: "p-2", matchId, teamId: awayTeamId, captainId: awayCaptainId, role: "AWAY" as const, createdAt: new Date() },
    ],
  };

  const valid5Slots = [
    { userId: "player-1", positionCode: "GK", sortOrder: 0 },
    { userId: "player-2", positionCode: "DEF", sortOrder: 1 },
    { userId: "player-3", positionCode: "MID_L", sortOrder: 2 },
    { userId: "player-4", positionCode: "MID_R", sortOrder: 3 },
    { userId: "player-5", positionCode: "FWD", sortOrder: 4 },
  ];

  const validPlayerCardMap = new Map([
    ["player-1", { userId: "player-1", displayName: "Ali GK", avatarUrl: "https://example.com/gk.jpg", primaryPosition: "GK" as const, role: "MEMBER" as const, teamRole: "MEMBER" as const, joinedAt: "2026-01-01T00:00:00.000Z", verifiedAppearances: 0, cardTheme: "FOOTCONNECT_BASE" as const }],
    ["player-2", { userId: "player-2", displayName: "Brahim DEF", avatarUrl: null, primaryPosition: "DEF" as const, role: "MEMBER" as const, teamRole: "MEMBER" as const, joinedAt: "2026-01-01T00:00:00.000Z", verifiedAppearances: 0, cardTheme: "FOOTCONNECT_BASE" as const }],
    ["player-3", { userId: "player-3", displayName: "Chafik MID", avatarUrl: null, primaryPosition: "MID" as const, role: "MEMBER" as const, teamRole: "MEMBER" as const, joinedAt: "2026-01-01T00:00:00.000Z", verifiedAppearances: 0, cardTheme: "FOOTCONNECT_BASE" as const }],
    ["player-4", { userId: "player-4", displayName: "Djamel MID", avatarUrl: null, primaryPosition: "MID" as const, role: "MEMBER" as const, teamRole: "MEMBER" as const, joinedAt: "2026-01-01T00:00:00.000Z", verifiedAppearances: 0, cardTheme: "FOOTCONNECT_BASE" as const }],
    ["player-5", { userId: "player-5", displayName: "Elias FWD", avatarUrl: "https://example.com/fwd.jpg", primaryPosition: "FWD" as const, role: "CAPTAIN" as const, teamRole: "CAPTAIN" as const, joinedAt: "2026-01-01T00:00:00.000Z", verifiedAppearances: 0, cardTheme: "FOOTCONNECT_BASE" as const }],
  ]);

  const mockCreatedSnapshot = (teamId: string, submittedById: string, version: number = 1) => ({
    id: `snapshot-${teamId}-v${version}`,
    matchId,
    teamId,
    formationCode: "1-2-1",
    submittedById,
    submittedAt: beforeStart,
    version,
    isCurrent: true,
    replacedAt: null,
    replacedById: null,
    replacementReason: null,
    players: valid5Slots.map((s) => ({
      id: `p-${s.userId}`,
      snapshotId: `snapshot-${teamId}-v${version}`,
      userId: s.userId,
      displayName: validPlayerCardMap.get(s.userId)?.displayName ?? "Player",
      avatarUrl: validPlayerCardMap.get(s.userId)?.avatarUrl ?? null,
      primaryPosition: validPlayerCardMap.get(s.userId)?.primaryPosition ?? null,
      positionCode: s.positionCode,
      sortOrder: s.sortOrder,
    })),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Both Teams: Home and Away captains can submit before match start
  it("allows designated HOME captain to submit lineup before match start", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(null);
    vi.spyOn(teamsService, "validateMatchLineup").mockResolvedValueOnce(validPlayerCardMap);
    const createSpy = vi.spyOn(repo, "createLineupSnapshot").mockResolvedValueOnce(
      mockCreatedSnapshot(homeTeamId, homeCaptainId, 1),
    );

    const snapshot = await matchesService.submitMatchLineup(
      homeCaptainId,
      matchId,
      homeTeamId,
      { formationCode: "1-2-1", slots: valid5Slots },
      undefined,
      beforeStart,
    );

    expect(teamsService.validateMatchLineup).toHaveBeenCalledWith(
      homeTeamId,
      "FIVE_A_SIDE",
      { formationCode: "1-2-1", slots: valid5Slots },
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId,
        teamId: homeTeamId,
        formationCode: "1-2-1",
        submittedById: homeCaptainId,
        version: 1,
        isCurrent: true,
      }),
      expect.anything(),
    );
    expect(snapshot.version).toBe(1);
    expect(snapshot.isCurrent).toBe(true);
    expect(snapshot.players).toHaveLength(5);
    expect(snapshot.players[0]?.displayName).toBe("Ali GK");
    expect(snapshot.players[0]?.avatarUrl).toBe("https://example.com/gk.jpg");
    expect(snapshot.players[0]?.primaryPosition).toBe("GK");
  });

  it("allows designated AWAY captain to submit lineup before match start", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(null);
    vi.spyOn(teamsService, "validateMatchLineup").mockResolvedValueOnce(validPlayerCardMap);
    const createSpy = vi.spyOn(repo, "createLineupSnapshot").mockResolvedValueOnce(
      mockCreatedSnapshot(awayTeamId, awayCaptainId, 1),
    );

    const snapshot = await matchesService.submitMatchLineup(
      awayCaptainId,
      matchId,
      awayTeamId,
      { formationCode: "1-2-1", slots: valid5Slots },
      undefined,
      beforeStart,
    );

    expect(teamsService.validateMatchLineup).toHaveBeenCalledWith(
      awayTeamId,
      "FIVE_A_SIDE",
      { formationCode: "1-2-1", slots: valid5Slots },
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId,
        teamId: awayTeamId,
        formationCode: "1-2-1",
        submittedById: awayCaptainId,
        version: 1,
        isCurrent: true,
      }),
      expect.anything(),
    );
    expect(snapshot.teamId).toBe(awayTeamId);
    expect(snapshot.version).toBe(1);
  });

  // 2. Wrong Captain: Rejects non-captain or cross-captain submissions with 403
  it("rejects non-captain member submitting for home team with 403", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.submitMatchLineup(
        "member-not-captain",
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });

  it("rejects away captain submitting for home team with 403", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.submitMatchLineup(
        awayCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });

  it("rejects home captain submitting for away team with 403", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        awayTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });

  it("rejects outsider user with 403", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.submitMatchLineup(
        outsiderId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403 }));
  });

  it("rejects submission for non-participant team with 400", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        "team-other",
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400 }));
  });

  // 3. Wrong format / count
  it("rejects submission when teamsService rejects wrong player count or formation with 400", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(null);
    vi.spyOn(teamsService, "validateMatchLineup").mockRejectedValueOnce(
      new HttpError(400, "Lineup for format FIVE_A_SIDE requires exactly 5 players, but received 4."),
    );

    const badSlots = valid5Slots.slice(0, 4);

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: badSlots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400 }));
  });

  // 4. Inactive player
  it("rejects submission when player is not an active team member with 400", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(null);
    vi.spyOn(teamsService, "validateMatchLineup").mockRejectedValueOnce(
      new HttpError(400, "User 'inactive-user' is not an active member of this team."),
    );

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400 }));
  });

  // 5. Duplicate
  it("rejects submission when duplicate players or sort orders are detected in slots with 400", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(null);
    vi.spyOn(teamsService, "validateMatchLineup").mockRejectedValueOnce(
      new HttpError(400, "Duplicate player in lineup: player-1"),
    );

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400 }));
  });

  it("rejects duplicate initial submission without replacement flag with 409", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(
      mockCreatedSnapshot(homeTeamId, homeCaptainId, 1),
    );

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409 }));
  });

  // 6. Replacement
  it("allows replacement before deadline retaining previous snapshot version and incrementing version to 2", async () => {
    const existingV1 = mockCreatedSnapshot(homeTeamId, homeCaptainId, 1);
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(existingV1);
    vi.spyOn(teamsService, "validateMatchLineup").mockResolvedValueOnce(validPlayerCardMap);

    const supersedeSpy = vi.spyOn(repo, "supersedeLineupSnapshot").mockResolvedValueOnce(undefined);
    const createSpy = vi.spyOn(repo, "createLineupSnapshot").mockResolvedValueOnce(
      mockCreatedSnapshot(homeTeamId, homeCaptainId, 2),
    );

    const replaced = await matchesService.replaceMatchLineup(
      homeCaptainId,
      matchId,
      homeTeamId,
      {
        formationCode: "1-2-1",
        slots: valid5Slots,
        reason: "Tactical adjustment by captain",
      },
      undefined,
      beforeStart,
    );

    expect(supersedeSpy).toHaveBeenCalledWith(
      existingV1.id,
      {
        replacedById: homeCaptainId,
        replacementReason: "Tactical adjustment by captain",
      },
      expect.anything(),
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId,
        teamId: homeTeamId,
        version: 2,
        isCurrent: true,
      }),
      expect.anything(),
    );
    expect(replaced.version).toBe(2);
  });

  it("rejects replacement when no existing lineup snapshot exists with 404", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);
    vi.spyOn(repo, "findLatestLineupSnapshot").mockResolvedValueOnce(null);

    await expect(
      matchesService.replaceMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        beforeStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404 }));
  });

  // 7. Deadline: after start returns 409
  it("rejects initial submission after match start with 409", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.submitMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        afterStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409 }));
  });

  it("rejects replacement after match start with 409", async () => {
    vi.spyOn(repo, "findMatchById").mockResolvedValueOnce(matchFixture);

    await expect(
      matchesService.replaceMatchLineup(
        homeCaptainId,
        matchId,
        homeTeamId,
        { formationCode: "1-2-1", slots: valid5Slots },
        undefined,
        afterStart,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409 }));
  });
});
