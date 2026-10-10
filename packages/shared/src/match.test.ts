import { describe, expect, it } from "vitest";
import {
  matchParticipantRoleSchema,
  matchParticipantSchema,
  matchStatusSchema,
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
});
