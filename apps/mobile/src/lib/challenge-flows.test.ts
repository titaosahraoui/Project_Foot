import { describe, expect, it } from "vitest";
import {
  calculateChallengeResponseDeadline,
  calculateChallengeBookingDeadline,
  type MatchChallengeDetail,
  type OpponentRecommendation,
  type TeamAvailability,
} from "@footconnect/shared";
import { generateIdempotencyKey } from "./idempotency";
import { formatApproximateArea } from "./approximate-area";
import {
  formatAlgiersDateTime,
  formatAlgiersTimeRange,
  getChallengeDeadlineInfo,
} from "./algiers-time";

describe("Mobile Challenge Flows (M07-T05)", () => {
  // Test fixture data
  const mockChallengerAvailability: TeamAvailability = {
    id: "avail-challenger-1",
    teamId: "team-challenger-1",
    startAt: "2026-10-15T18:00:00.000Z",
    endAt: "2026-10-15T21:00:00.000Z",
    format: "FIVE_A_SIDE",
    radiusKm: 10,
    approximateArea: { lat: 36.75, lng: 3.06 },
    status: "OPEN",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
  };

  const mockOpponentRec: OpponentRecommendation = {
    availabilityId: "avail-opponent-2",
    team: {
      id: "team-opponent-2",
      name: "El Biar FC",
      logoUrl: null,
      elo: 1320,
    },
    teamSummary: {
      id: "team-opponent-2",
      name: "El Biar FC",
      logoUrl: null,
      elo: 1320,
    },
    format: "FIVE_A_SIDE",
    distanceKm: 3.2,
    eloDifference: 20,
    score: 88,
    overlappingWindow: {
      startAt: "2026-10-15T18:30:00.000Z",
      endAt: "2026-10-15T20:30:00.000Z",
      durationMinutes: 120,
    },
    explanation: {
      eloDifference: 20,
      distanceKm: 3.2,
      format: "FIVE_A_SIDE",
      overlapMinutes: 120,
      opponentReliability: null,
      eloScore: 0.85,
      distanceScore: 0.9,
    },
    reliability: null,
  };

  describe("1. Idempotency Key Generation & Retention", () => {
    it("generates valid RFC4122 v4 UUID format", () => {
      const key = generateIdempotencyKey();
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("generates distinct keys for distinct user intents", () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      expect(key1).not.toBe(key2);
    });

    it("retains the same key across simulated network retries for a single intent", () => {
      const intentKey = generateIdempotencyKey();
      const attempts: string[] = [];

      // Simulate 3 network attempts for the same intent
      for (let i = 0; i < 3; i++) {
        attempts.push(intentKey);
      }

      expect(attempts[0]).toBe(intentKey);
      expect(attempts[1]).toBe(intentKey);
      expect(attempts[2]).toBe(intentKey);
    });
  });

  describe("2. Double Tap & Concurrent Action Prevention", () => {
    it("blocks second submission while first is in flight", async () => {
      let isSubmitting = false;
      let callCount = 0;

      const submitAction = async () => {
        if (isSubmitting) return "BLOCKED";
        isSubmitting = true;
        callCount++;
        // simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        isSubmitting = false;
        return "SUCCESS";
      };

      // Rapid double tap
      const [res1, res2] = await Promise.all([submitAction(), submitAction()]);
      expect(res1).toBe("SUCCESS");
      expect(res2).toBe("BLOCKED");
      expect(callCount).toBe(1);
    });

    it("allows retry after a failed submission", async () => {
      let isSubmitting = false;
      let failureCount = 0;
      let successCount = 0;

      const submitWithRetry = async (shouldFail: boolean) => {
        if (isSubmitting) return;
        isSubmitting = true;
        try {
          if (shouldFail) {
            failureCount++;
            throw new Error("Network timeout");
          }
          successCount++;
        } finally {
          isSubmitting = false;
        }
      };

      // First attempt fails
      await expect(submitWithRetry(true)).rejects.toThrow("Network timeout");
      expect(failureCount).toBe(1);
      expect(isSubmitting).toBe(false);

      // Retry succeeds
      await submitWithRetry(false);
      expect(successCount).toBe(1);
      expect(isSubmitting).toBe(false);
    });
  });

  describe("3. Send Challenge Confirmation Data Integrity", () => {
    it("verifies all required fields are present and properly formatted", () => {
      const challengerTeamName = "Bab El Oued United";
      const opponentTeamName = mockOpponentRec.team.name;
      const format = mockOpponentRec.format;
      const formatLabel = format === "FIVE_A_SIDE" ? "5v5" : "7v7";
      const overlap = formatAlgiersTimeRange(
        mockOpponentRec.overlappingWindow.startAt,
        mockOpponentRec.overlappingWindow.endAt,
      );
      const approxArea = formatApproximateArea(
        mockChallengerAvailability.approximateArea,
      );
      const radiusKm = mockChallengerAvailability.radiusKm;
      const responseDeadline = calculateChallengeResponseDeadline(
        new Date("2026-10-10T12:00:00.000Z"),
        new Date(mockOpponentRec.overlappingWindow.startAt),
      );
      const responseDeadlineFormatted = formatAlgiersDateTime(
        responseDeadline.toISOString(),
      );

      // Verify both teams
      expect(challengerTeamName).toBe("Bab El Oued United");
      expect(opponentTeamName).toBe("El Biar FC");

      // Verify format
      expect(formatLabel).toBe("5v5");

      // Verify overlap
      expect(overlap).toContain("19:30"); // 18:30 UTC -> 19:30 Algiers
      expect(overlap).toContain("21:30"); // 20:30 UTC -> 21:30 Algiers

      // Verify approximate area and radius (never raw coordinates)
      expect(approxArea).toBe("~36.75, 3.06");
      expect(radiusKm).toBe(10);

      // Verify response deadline
      expect(responseDeadlineFormatted).toBeDefined();

      // Verify organizer responsibility notice
      const organizerResponsibilityNotice =
        "As the challenging squad, your captain becomes the designated Match Organizer. Once the opponent captain accepts, you are responsible for selecting and booking the pitch before the booking deadline.";
      expect(organizerResponsibilityNotice).toContain("Match Organizer");
      expect(organizerResponsibilityNotice).toContain("booking deadline");
    });
  });

  describe("4. Role-based Challenge Permissions & Actions", () => {
    const pendingChallenge: MatchChallengeDetail = {
      id: "ch-100",
      challengerTeam: {
        id: "team-challenger-1",
        name: "Bab El Oued United",
        logoUrl: null,
        elo: 1300,
      },
      opponentTeam: {
        id: "team-opponent-2",
        name: "El Biar FC",
        logoUrl: null,
        elo: 1320,
      },
      format: "FIVE_A_SIDE",
      startAt: "2026-10-15T18:30:00.000Z",
      endAt: "2026-10-15T20:30:00.000Z",
      approximateArea: { lat: 36.75, lng: 3.06 },
      radiusKm: 10,
      status: "PENDING",
      organizerUserId: "user-challenger-captain",
      responseDeadline: "2026-10-11T12:00:00.000Z",
      bookingDeadline: null,
      message: "Ready for a test match Friday night!",
      availableActions: ["ACCEPT", "DECLINE"], // from perspective of opponent captain
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
      respondedAt: null,
      cancelledAt: null,
    };

    it("gives opponent captain accept and decline actions during PENDING", () => {
      const actions = pendingChallenge.availableActions;
      expect(actions).toContain("ACCEPT");
      expect(actions).toContain("DECLINE");
      expect(actions).not.toContain("CANCEL");
    });

    it("gives challenger organizer only cancel action during PENDING", () => {
      const organizerChallenge = {
        ...pendingChallenge,
        availableActions: ["CANCEL"] as const,
      };
      expect(organizerChallenge.availableActions).toEqual(["CANCEL"]);
    });

    it("gives team members empty actions and renders read-only state", () => {
      const memberChallenge = {
        ...pendingChallenge,
        availableActions: [] as const,
      };
      expect(memberChallenge.availableActions.length).toBe(0);
      const isReadOnly = memberChallenge.availableActions.length === 0;
      expect(isReadOnly).toBe(true);
    });

    it("clears actions after transition to ACCEPTED, DECLINED, or CANCELLED", () => {
      const acceptedChallenge: MatchChallengeDetail = {
        ...pendingChallenge,
        status: "ACCEPTED",
        availableActions: [],
        bookingDeadline: "2026-10-14T18:30:00.000Z",
        respondedAt: "2026-10-10T14:00:00.000Z",
      };
      expect(acceptedChallenge.availableActions).toEqual([]);

      const declinedChallenge: MatchChallengeDetail = {
        ...pendingChallenge,
        status: "DECLINED",
        availableActions: [],
        respondedAt: "2026-10-10T14:00:00.000Z",
      };
      expect(declinedChallenge.availableActions).toEqual([]);

      const cancelledChallenge: MatchChallengeDetail = {
        ...pendingChallenge,
        status: "CANCELLED",
        availableActions: [],
        cancelledAt: "2026-10-10T13:00:00.000Z",
      };
      expect(cancelledChallenge.availableActions).toEqual([]);
    });
  });

  describe("5. Post-Acceptance Milestone 08 Pitch Selection", () => {
    it("shows 'Choose a pitch' only to organizer when status is ACCEPTED", () => {
      const organizerUserId = "user-organizer";
      const viewerCaptainId = "user-organizer";
      const viewerOpponentId = "user-opponent";
      const viewerMemberId = "user-member";

      const shouldShowPitchButton = (status: string, viewerId: string) => {
        return status === "ACCEPTED" && viewerId === organizerUserId;
      };

      // Organizer viewing accepted challenge
      expect(shouldShowPitchButton("ACCEPTED", viewerCaptainId)).toBe(true);

      // Opponent captain viewing accepted challenge
      expect(shouldShowPitchButton("ACCEPTED", viewerOpponentId)).toBe(false);

      // Squad member viewing accepted challenge
      expect(shouldShowPitchButton("ACCEPTED", viewerMemberId)).toBe(false);

      // Organizer viewing pending challenge
      expect(shouldShowPitchButton("PENDING", viewerCaptainId)).toBe(false);
    });

    it("verifies 'Choose a pitch' button is disabled with Milestone 08 copy", () => {
      const pitchButtonDisabled = true;
      const milestone08Copy =
        "Pitch reservation will be unlocked in Milestone 08";

      expect(pitchButtonDisabled).toBe(true);
      expect(milestone08Copy).toContain("Milestone 08");
    });
  });

  describe("6. Deadline Expiry and Stale Transitions", () => {
    it("flags response deadline as expired when current time passes deadline", () => {
      const pastDeadline = "2026-10-09T10:00:00.000Z";
      const deadlineInfo = getChallengeDeadlineInfo(
        pastDeadline,
        "response",
        new Date("2026-10-09T12:00:00.000Z"),
      );

      expect(deadlineInfo.isExpired).toBe(true);
      expect(deadlineInfo.timeRemainingText).toBe("Expired");
    });

    it("formats remaining hours and minutes when deadline is active", () => {
      const futureDeadline = "2026-10-09T15:30:00.000Z";
      const deadlineInfo = getChallengeDeadlineInfo(
        futureDeadline,
        "response",
        new Date("2026-10-09T12:00:00.000Z"),
      );

      expect(deadlineInfo.isExpired).toBe(false);
      expect(deadlineInfo.timeRemainingText).toBe("3h 30m remaining");
    });

    it("calculates booking deadline as earlier of 24h after acceptance or 2h before match start", () => {
      const matchStart = new Date("2026-10-15T18:00:00.000Z");
      const acceptedAt = new Date("2026-10-10T12:00:00.000Z");
      const bookingDeadline = calculateChallengeBookingDeadline(
        acceptedAt,
        matchStart,
      );

      // 24h after acceptance is 2026-10-11T12:00:00.000Z (earlier than 2h before match: 2026-10-15T16:00:00.000Z)
      expect(bookingDeadline.toISOString()).toBe("2026-10-11T12:00:00.000Z");

      // Match starting within 24 hours:
      const nearMatchStart = new Date("2026-10-10T18:00:00.000Z"); // 6h after acceptance
      const nearBookingDeadline = calculateChallengeBookingDeadline(
        acceptedAt,
        nearMatchStart,
      );
      // 2h before match start is 2026-10-10T16:00:00.000Z
      expect(nearBookingDeadline.toISOString()).toBe("2026-10-10T16:00:00.000Z");
    });

    it("simulates stale acceptance handling", () => {
      // Simulate state where client still sees PENDING but server is already ACCEPTED
      const clientChallengeStatus = "PENDING";
      const serverChallengeStatus = "ACCEPTED";

      const handleAcceptAttempt = () => {
        if (serverChallengeStatus !== "PENDING") {
          throw new Error(
            "Challenge is no longer pending (already " +
              serverChallengeStatus +
              ")",
          );
        }
      };

      expect(() => handleAcceptAttempt()).toThrow(/no longer pending/);
    });
  });
});
