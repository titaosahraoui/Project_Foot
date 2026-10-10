import { describe, expect, it } from "vitest";
import {
  formatMatchAlgiersLabels,
  matchDetailSchema,
  matchParticipantRoleSchema,
  matchParticipantSchema,
  matchStatusSchema,
  matchSummarySchema,
  scheduleMatchFromBookingSchema,
  scheduledMatchSummarySchema,
} from "./match";

describe("match schemas", () => {
  it("validates all MatchStatus values", () => {
    const statuses = [
      "SCHEDULED",
      "AWAITING_RESULTS",
      "CONSENSUS_PENDING",
      "VERIFIED",
      "DISPUTED",
      "CANCELLED",
      "NO_SHOW",
    ];

    for (const status of statuses) {
      expect(matchStatusSchema.parse(status)).toBe(status);
    }

    expect(() => matchStatusSchema.parse("UNKNOWN_STATUS")).toThrow();
  });

  it("validates MatchParticipantRole values", () => {
    expect(matchParticipantRoleSchema.parse("HOME")).toBe("HOME");
    expect(matchParticipantRoleSchema.parse("AWAY")).toBe("AWAY");
    expect(() => matchParticipantRoleSchema.parse("REFEREE")).toThrow();
  });

  it("validates MatchParticipant schema", () => {
    const participant = {
      id: "11111111-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      matchId: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      teamId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      captainId: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      role: "HOME",
      createdAt: "2026-10-10T12:00:00.000Z",
    };
    const parsed = matchParticipantSchema.parse(participant);
    expect(parsed.role).toBe("HOME");
  });

  it("validates a complete ScheduledMatchSummary with participants", () => {
    const data = {
      id: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      bookingId: "b1b1b1b1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      homeTeamId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      awayTeamId: "d1d1d1d1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      homeCaptainId: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      awayCaptainId: "f1f1f1f1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      pitchOwnerId: "01010101-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      startAt: "2026-10-15T18:00:00.000Z",
      endAt: "2026-10-15T19:30:00.000Z",
      format: "FIVE_A_SIDE",
      status: "SCHEDULED",
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
      participants: [
        {
          id: "11111111-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          matchId: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          teamId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          captainId: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          role: "HOME",
          createdAt: "2026-10-10T12:00:00.000Z",
        },
        {
          id: "22222222-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          matchId: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          teamId: "d1d1d1d1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          captainId: "f1f1f1f1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          role: "AWAY",
          createdAt: "2026-10-10T12:00:00.000Z",
        },
      ],
    };

    const parsed = scheduledMatchSummarySchema.parse(data);
    expect(parsed.id).toBe(data.id);
    expect(parsed.status).toBe("SCHEDULED");
    expect(parsed.participants).toHaveLength(2);
    expect(parsed.participants?.[0]?.role).toBe("HOME");
  });

  it("validates scheduleMatchFromBookingSchema", () => {
    const input = {
      bookingId: "b1b1b1b1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      homeTeamId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      awayTeamId: "d1d1d1d1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      pitchOwnerId: "01010101-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      startAt: "2026-10-15T18:00:00.000Z",
      endAt: "2026-10-15T19:30:00.000Z",
      format: "SEVEN_A_SIDE",
    };

    const parsed = scheduleMatchFromBookingSchema.parse(input);
    expect(parsed.bookingId).toBe(input.bookingId);
    expect(parsed.format).toBe("SEVEN_A_SIDE");
  });

  it("formats Africa/Algiers timezone labels with fixed UTC+1 offset", () => {
    const startAt = "2026-11-20T18:00:00.000Z"; // 19:00 in Algiers
    const endAt = "2026-11-20T19:30:00.000Z"; // 20:30 in Algiers

    const labels = formatMatchAlgiersLabels(startAt, endAt);
    expect(labels.algiersKickoffLabel).toBe("19:00");
    expect(labels.algiersTimeRangeLabel).toBe("19:00 – 20:30");
    expect(labels.algiersDateLabel).toContain("Nov 20, 2026");
  });

  it("validates MatchSummary and MatchDetail schemas", () => {
    const summaryData = {
      id: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      bookingId: "b1b1b1b1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      homeTeamId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      awayTeamId: "d1d1d1d1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      homeCaptainId: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      awayCaptainId: "f1f1f1f1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      pitchOwnerId: "01010101-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
      startAt: "2026-11-20T18:00:00.000Z",
      endAt: "2026-11-20T19:30:00.000Z",
      format: "FIVE_A_SIDE",
      status: "SCHEDULED",
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
      homeTeam: {
        id: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
        name: "El Harrach Stars",
        logoUrl: null,
        elo: 1250,
      },
      awayTeam: {
        id: "d1d1d1d1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
        name: "Bab El Oued FC",
        logoUrl: null,
        elo: 1180,
      },
      pitch: {
        id: "99999999-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
        name: "Stade du 5 Juillet Arena",
        address: "123 Stadium Ave",
        city: "Algiers",
        surface: "ARTIFICIAL_TURF",
        format: "FIVE_A_SIDE",
      },
      homeCaptain: {
        id: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
        displayName: "Riyad M.",
      },
      awayCaptain: {
        id: "f1f1f1f1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
        displayName: "Ismail B.",
      },
      algiersDateLabel: "Fri, Nov 20, 2026",
      algiersTimeRangeLabel: "19:00 – 20:30",
      algiersKickoffLabel: "19:00",
      priceAmountMinor: 400000,
      currency: "DZD",
      paymentStatus: "UNPAID",
    };

    const parsedSummary = matchSummarySchema.parse(summaryData);
    expect(parsedSummary.status).toBe("SCHEDULED");
    expect(parsedSummary.priceAmountMinor).toBe(400000);
    expect(parsedSummary.currency).toBe("DZD");

    const detailData = {
      ...summaryData,
      pitchOwner: {
        id: "01010101-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
        displayName: "Stadium Owner",
      },
      participants: [
        {
          id: "11111111-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          matchId: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          teamId: "c1c1c1c1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          captainId: "e1e1e1e1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
          role: "HOME",
          createdAt: "2026-10-10T12:00:00.000Z",
        },
      ],
      viewerActions: {
        canSubmitLineup: true,
        lineupDeadline: "2026-11-20T17:45:00.000Z",
        canCancel: false,
        canSubmitResult: false,
        canDispute: false,
        role: "HOME_CAPTAIN",
        allowedActions: ["SUBMIT_LINEUP"],
      },
    };

    const parsedDetail = matchDetailSchema.parse(detailData);
    expect(parsedDetail.participants).toHaveLength(1);
    expect(parsedDetail.viewerActions.canSubmitLineup).toBe(true);
    expect(parsedDetail.pitchOwner.displayName).toBe("Stadium Owner");
  });
});
