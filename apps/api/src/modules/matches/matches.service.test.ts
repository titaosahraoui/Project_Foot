import { describe, expect, it, vi } from "vitest";
import * as repo from "./matches.repository";
import * as matchesService from "./matches.service";
import * as teamsService from "../teams/teams.service";

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
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
  });

  it("getMatchByBookingId returns null when no match exists", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(null);

    const result = await matchesService.getMatchByBookingId("unknown-booking");
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("getMatchByBookingId returns mapped match summary when match exists", async () => {
    vi.spyOn(repo, "findMatchByBookingId").mockResolvedValueOnce(dummyMatch);

    const result = await matchesService.getMatchByBookingId("booking-123");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("match-123");
    expect(result?.participants).toHaveLength(2);
    vi.restoreAllMocks();
  });
});
