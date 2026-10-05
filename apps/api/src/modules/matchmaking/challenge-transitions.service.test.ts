import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChallengeStatus } from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import * as teamsService from "../teams/teams.service";
import * as repo from "./matchmaking.repository";
import {
  acceptChallenge,
  cancelChallenge,
  declineChallenge,
  expireDueChallenges,
} from "./matchmaking.service";

vi.mock("../teams/teams.service");
vi.mock("./matchmaking.repository");
vi.mock("../../lib/transaction", () => ({
  withTransaction: vi.fn((cb) => cb({})),
}));

describe("Challenge Transitions (table-driven transition tests)", () => {
  const challengerCaptainId = randomUUID();
  const opponentCaptainId = randomUUID();
  const unrelatedUserId = randomUUID();

  const challengerTeamId = randomUUID();
  const opponentTeamId = randomUUID();

  const challengerAvailabilityId = randomUUID();
  const opponentAvailabilityId = randomUUID();

  const now = new Date("2026-10-06T10:00:00.000Z");
  const matchStart = new Date("2026-10-06T18:00:00.000Z"); // 8h after now
  const matchEnd = new Date("2026-10-06T20:00:00.000Z");
  const responseDeadline = new Date("2026-10-06T14:00:00.000Z"); // 4h before matchStart
  const bookingDeadline = new Date("2026-10-06T16:00:00.000Z"); // 2h before matchStart

  function buildChallenge(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      challengerTeamId,
      opponentTeamId,
      challengerAvailabilityId,
      opponentAvailabilityId,
      organizerUserId: challengerCaptainId,
      format: "FIVE_A_SIDE" as const,
      startAt: matchStart,
      endAt: matchEnd,
      originLat: 36.7538,
      originLng: 3.0588,
      radiusKm: 10,
      responseDeadline,
      bookingDeadline: null,
      status: "PENDING" as ChallengeStatus,
      message: "Great game proposed",
      respondedAt: null,
      cancelledAt: null,
      createdAt: new Date("2026-10-05T12:00:00.000Z"),
      updatedAt: new Date("2026-10-05T12:00:00.000Z"),
      ...overrides,
    };
  }

  function buildAvailability(id: string, teamId: string, status: "OPEN" | "MATCHED" | "CANCELLED" | "EXPIRED" = "OPEN") {
    return {
      id,
      teamId,
      createdById: teamId === challengerTeamId ? challengerCaptainId : opponentCaptainId,
      startAt: matchStart,
      endAt: matchEnd,
      format: "FIVE_A_SIDE" as const,
      originLat: 36.7538,
      originLng: 3.0588,
      radiusKm: 10,
      eloTolerance: 150,
      message: null,
      status,
      expiresAt: matchStart,
      matchedAt: status === "MATCHED" ? new Date("2026-10-05T15:00:00.000Z") : null,
      cancelledAt: null,
      createdAt: new Date("2026-10-05T12:00:00.000Z"),
      updatedAt: new Date("2026-10-05T12:00:00.000Z"),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(teamsService.assertActiveCaptain).mockImplementation(async (teamId, userId) => {
      if (teamId === opponentTeamId && userId === opponentCaptainId) {
        return { id: teamId } as any;
      }
      if (teamId === challengerTeamId && userId === challengerCaptainId) {
        return { id: teamId } as any;
      }
      throw new HttpError(403, "Only the team captain can do that");
    });

    vi.mocked(repo.acquireAvailabilityLock).mockResolvedValue(undefined);
    vi.mocked(repo.matchAvailabilities).mockResolvedValue({ count: 2 });
    vi.mocked(repo.expireOtherPendingChallenges).mockResolvedValue({ count: 0 });
    vi.mocked(repo.updateChallenge).mockImplementation(async (id, data) => {
      return buildChallenge({ id, ...data });
    });
  });

  interface TransitionTestCase {
    description: string;
    initialStatus: ChallengeStatus;
    action: "accept" | "decline" | "cancel";
    actor: "opponent_captain" | "challenger_captain_organizer" | "unrelated_user";
    clockTime?: Date;
    challengerAvailStatus?: "OPEN" | "MATCHED" | "CANCELLED" | "EXPIRED";
    opponentAvailStatus?: "OPEN" | "MATCHED" | "CANCELLED" | "EXPIRED";
    alreadyHasRespondedAt?: boolean;
    alreadyHasCancelledAt?: boolean;
    alreadyHasBookingDeadline?: boolean;
    expectedSuccess: boolean;
    expectedStatus?: ChallengeStatus;
    expectedErrorStatus?: number;
    expectedErrorMessage?: string;
  }

  const transitionMatrix: TransitionTestCase[] = [
    // ---------------- PENDING state transitions ----------------
    {
      description: "PENDING -> accept by opponent captain succeeds",
      initialStatus: "PENDING",
      action: "accept",
      actor: "opponent_captain",
      expectedSuccess: true,
      expectedStatus: "ACCEPTED",
    },
    {
      description: "PENDING -> accept by challenger captain (organizer) rejected (403)",
      initialStatus: "PENDING",
      action: "accept",
      actor: "challenger_captain_organizer",
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },
    {
      description: "PENDING -> accept by unrelated user rejected (403)",
      initialStatus: "PENDING",
      action: "accept",
      actor: "unrelated_user",
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },
    {
      description: "PENDING -> accept after responseDeadline expired rejected (409)",
      initialStatus: "PENDING",
      action: "accept",
      actor: "opponent_captain",
      clockTime: new Date("2026-10-06T15:00:00.000Z"), // after responseDeadline (14:00)
      expectedSuccess: false,
      expectedErrorStatus: 409,
      expectedErrorMessage: "Challenge has expired",
    },
    {
      description: "PENDING -> accept when challenger availability is already MATCHED rejected (409)",
      initialStatus: "PENDING",
      action: "accept",
      actor: "opponent_captain",
      challengerAvailStatus: "MATCHED",
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "PENDING -> accept when opponent availability is already MATCHED rejected (409)",
      initialStatus: "PENDING",
      action: "accept",
      actor: "opponent_captain",
      opponentAvailStatus: "MATCHED",
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "PENDING -> decline by opponent captain succeeds",
      initialStatus: "PENDING",
      action: "decline",
      actor: "opponent_captain",
      expectedSuccess: true,
      expectedStatus: "DECLINED",
    },
    {
      description: "PENDING -> decline by challenger captain rejected (403)",
      initialStatus: "PENDING",
      action: "decline",
      actor: "challenger_captain_organizer",
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },
    {
      description: "PENDING -> decline by unrelated user rejected (403)",
      initialStatus: "PENDING",
      action: "decline",
      actor: "unrelated_user",
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },
    {
      description: "PENDING -> decline after responseDeadline expired rejected (409)",
      initialStatus: "PENDING",
      action: "decline",
      actor: "opponent_captain",
      clockTime: new Date("2026-10-06T15:00:00.000Z"),
      expectedSuccess: false,
      expectedErrorStatus: 409,
      expectedErrorMessage: "Challenge has expired",
    },
    {
      description: "PENDING -> cancel by organizer succeeds",
      initialStatus: "PENDING",
      action: "cancel",
      actor: "challenger_captain_organizer",
      expectedSuccess: true,
      expectedStatus: "CANCELLED",
    },
    {
      description: "PENDING -> cancel by opponent captain rejected (403)",
      initialStatus: "PENDING",
      action: "cancel",
      actor: "opponent_captain",
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },
    {
      description: "PENDING -> cancel by unrelated user rejected (403)",
      initialStatus: "PENDING",
      action: "cancel",
      actor: "unrelated_user",
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },
    {
      description: "PENDING -> cancel after responseDeadline expired rejected (409)",
      initialStatus: "PENDING",
      action: "cancel",
      actor: "challenger_captain_organizer",
      clockTime: new Date("2026-10-06T15:00:00.000Z"),
      expectedSuccess: false,
      expectedErrorStatus: 409,
      expectedErrorMessage: "Challenge has expired",
    },

    // ---------------- ACCEPTED state transitions ----------------
    {
      description: "ACCEPTED -> accept by opponent captain is idempotent (returns current ACCEPTED state)",
      initialStatus: "ACCEPTED",
      action: "accept",
      actor: "opponent_captain",
      alreadyHasRespondedAt: true,
      alreadyHasBookingDeadline: true,
      expectedSuccess: true,
      expectedStatus: "ACCEPTED",
    },
    {
      description: "ACCEPTED -> decline by opponent captain rejected (409)",
      initialStatus: "ACCEPTED",
      action: "decline",
      actor: "opponent_captain",
      alreadyHasRespondedAt: true,
      alreadyHasBookingDeadline: true,
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "ACCEPTED -> cancel by organizer before bookingDeadline succeeds",
      initialStatus: "ACCEPTED",
      action: "cancel",
      actor: "challenger_captain_organizer",
      alreadyHasRespondedAt: true,
      alreadyHasBookingDeadline: true,
      expectedSuccess: true,
      expectedStatus: "CANCELLED",
    },
    {
      description: "ACCEPTED -> cancel by organizer after bookingDeadline expired rejected (409)",
      initialStatus: "ACCEPTED",
      action: "cancel",
      actor: "challenger_captain_organizer",
      alreadyHasRespondedAt: true,
      alreadyHasBookingDeadline: true,
      clockTime: new Date("2026-10-06T17:00:00.000Z"), // after bookingDeadline (16:00)
      expectedSuccess: false,
      expectedErrorStatus: 409,
      expectedErrorMessage: "Challenge has expired",
    },
    {
      description: "ACCEPTED -> cancel by opponent captain rejected (403)",
      initialStatus: "ACCEPTED",
      action: "cancel",
      actor: "opponent_captain",
      alreadyHasRespondedAt: true,
      alreadyHasBookingDeadline: true,
      expectedSuccess: false,
      expectedErrorStatus: 403,
    },

    // ---------------- DECLINED state transitions ----------------
    {
      description: "DECLINED -> decline by opponent captain is idempotent (returns current DECLINED state)",
      initialStatus: "DECLINED",
      action: "decline",
      actor: "opponent_captain",
      alreadyHasRespondedAt: true,
      expectedSuccess: true,
      expectedStatus: "DECLINED",
    },
    {
      description: "DECLINED -> accept by opponent captain rejected (409)",
      initialStatus: "DECLINED",
      action: "accept",
      actor: "opponent_captain",
      alreadyHasRespondedAt: true,
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "DECLINED -> cancel by organizer rejected (409)",
      initialStatus: "DECLINED",
      action: "cancel",
      actor: "challenger_captain_organizer",
      alreadyHasRespondedAt: true,
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },

    // ---------------- CANCELLED state transitions ----------------
    {
      description: "CANCELLED -> cancel by organizer is idempotent (returns current CANCELLED state)",
      initialStatus: "CANCELLED",
      action: "cancel",
      actor: "challenger_captain_organizer",
      alreadyHasCancelledAt: true,
      expectedSuccess: true,
      expectedStatus: "CANCELLED",
    },
    {
      description: "CANCELLED -> accept by opponent captain rejected (409)",
      initialStatus: "CANCELLED",
      action: "accept",
      actor: "opponent_captain",
      alreadyHasCancelledAt: true,
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "CANCELLED -> decline by opponent captain rejected (409)",
      initialStatus: "CANCELLED",
      action: "decline",
      actor: "opponent_captain",
      alreadyHasCancelledAt: true,
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },

    // ---------------- EXPIRED state transitions ----------------
    {
      description: "EXPIRED -> accept by opponent captain rejected (409)",
      initialStatus: "EXPIRED",
      action: "accept",
      actor: "opponent_captain",
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "EXPIRED -> decline by opponent captain rejected (409)",
      initialStatus: "EXPIRED",
      action: "decline",
      actor: "opponent_captain",
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
    {
      description: "EXPIRED -> cancel by organizer rejected (409)",
      initialStatus: "EXPIRED",
      action: "cancel",
      actor: "challenger_captain_organizer",
      expectedSuccess: false,
      expectedErrorStatus: 409,
    },
  ];

  function getActorId(actor: TransitionTestCase["actor"]): string {
    switch (actor) {
      case "opponent_captain":
        return opponentCaptainId;
      case "challenger_captain_organizer":
        return challengerCaptainId;
      case "unrelated_user":
        return unrelatedUserId;
    }
  }

  it.each(transitionMatrix)("$description", async (tc) => {
    const actorId = getActorId(tc.actor);
    const clock = tc.clockTime ?? now;

    const initialChallenge = buildChallenge({
      status: tc.initialStatus,
      respondedAt: tc.alreadyHasRespondedAt ? new Date("2026-10-06T09:00:00.000Z") : null,
      cancelledAt: tc.alreadyHasCancelledAt ? new Date("2026-10-06T09:00:00.000Z") : null,
      bookingDeadline: tc.alreadyHasBookingDeadline ? bookingDeadline : null,
    });

    vi.mocked(repo.findChallengeById).mockResolvedValue(initialChallenge);

    const cAvail = buildAvailability(
      challengerAvailabilityId,
      challengerTeamId,
      tc.challengerAvailStatus ?? (tc.initialStatus === "ACCEPTED" ? "MATCHED" : "OPEN"),
    );
    const oAvail = buildAvailability(
      opponentAvailabilityId,
      opponentTeamId,
      tc.opponentAvailStatus ?? (tc.initialStatus === "ACCEPTED" ? "MATCHED" : "OPEN"),
    );

    vi.mocked(repo.findAvailabilityById).mockImplementation(async (id) => {
      if (id === challengerAvailabilityId) return cAvail;
      if (id === opponentAvailabilityId) return oAvail;
      return null;
    });

    const invokeAction = () => {
      switch (tc.action) {
        case "accept":
          return acceptChallenge(actorId, initialChallenge.id, clock);
        case "decline":
          return declineChallenge(actorId, initialChallenge.id, clock);
        case "cancel":
          return cancelChallenge(actorId, initialChallenge.id, clock);
      }
    };

    if (tc.expectedSuccess) {
      const result = await invokeAction();
      expect(result.status).toBe(tc.expectedStatus);
      if (tc.action === "accept" && tc.initialStatus === "PENDING") {
        expect(result.respondedAt).toBe(clock.toISOString());
        expect(result.bookingDeadline).toBeDefined();
        expect(repo.matchAvailabilities).toHaveBeenCalledWith(
          [challengerAvailabilityId, opponentAvailabilityId],
          clock,
          expect.anything(),
        );
        expect(repo.expireOtherPendingChallenges).toHaveBeenCalledWith(
          initialChallenge.id,
          [challengerAvailabilityId, opponentAvailabilityId],
          expect.anything(),
        );
      }
      if (tc.action === "decline" && tc.initialStatus === "PENDING") {
        expect(result.respondedAt).toBe(clock.toISOString());
        expect(repo.matchAvailabilities).not.toHaveBeenCalled();
        expect(repo.expireOtherPendingChallenges).not.toHaveBeenCalled();
      }
      if (tc.action === "cancel" && (tc.initialStatus === "PENDING" || tc.initialStatus === "ACCEPTED")) {
        expect(result.cancelledAt).toBe(clock.toISOString());
        expect(repo.matchAvailabilities).not.toHaveBeenCalled();
        expect(repo.expireOtherPendingChallenges).not.toHaveBeenCalled();
      }
    } else {
      let err: any;
      try {
        await invokeAction();
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(tc.expectedErrorStatus);
      if (tc.expectedErrorMessage) {
        expect(err.message).toContain(tc.expectedErrorMessage);
      }
    }
  });

  describe("Repeat commands idempotency", () => {
    it("repeating acceptChallenge returns the existing accepted challenge without modifying respondedAt or re-executing side effects", async () => {
      const existingRespondedAt = new Date("2026-10-06T09:30:00.000Z");
      const existingBookingDeadline = new Date("2026-10-06T16:00:00.000Z");
      const acceptedChallenge = buildChallenge({
        status: "ACCEPTED",
        respondedAt: existingRespondedAt,
        bookingDeadline: existingBookingDeadline,
      });

      vi.mocked(repo.findChallengeById).mockResolvedValue(acceptedChallenge);

      const laterTime = new Date("2026-10-06T11:00:00.000Z");
      const result = await acceptChallenge(opponentCaptainId, acceptedChallenge.id, laterTime);

      expect(result.status).toBe("ACCEPTED");
      expect(result.respondedAt).toBe(existingRespondedAt.toISOString());
      expect(result.bookingDeadline).toBe(existingBookingDeadline.toISOString());
      expect(repo.updateChallenge).not.toHaveBeenCalled();
      expect(repo.matchAvailabilities).not.toHaveBeenCalled();
      expect(repo.expireOtherPendingChallenges).not.toHaveBeenCalled();
    });

    it("repeating declineChallenge returns the existing declined challenge without re-updating", async () => {
      const existingRespondedAt = new Date("2026-10-06T09:30:00.000Z");
      const declinedChallenge = buildChallenge({
        status: "DECLINED",
        respondedAt: existingRespondedAt,
      });

      vi.mocked(repo.findChallengeById).mockResolvedValue(declinedChallenge);

      const laterTime = new Date("2026-10-06T11:00:00.000Z");
      const result = await declineChallenge(opponentCaptainId, declinedChallenge.id, laterTime);

      expect(result.status).toBe("DECLINED");
      expect(result.respondedAt).toBe(existingRespondedAt.toISOString());
      expect(repo.updateChallenge).not.toHaveBeenCalled();
    });

    it("repeating cancelChallenge returns the existing cancelled challenge without re-updating", async () => {
      const existingCancelledAt = new Date("2026-10-06T09:30:00.000Z");
      const cancelledChallenge = buildChallenge({
        status: "CANCELLED",
        cancelledAt: existingCancelledAt,
      });

      vi.mocked(repo.findChallengeById).mockResolvedValue(cancelledChallenge);

      const laterTime = new Date("2026-10-06T11:00:00.000Z");
      const result = await cancelChallenge(challengerCaptainId, cancelledChallenge.id, laterTime);

      expect(result.status).toBe("CANCELLED");
      expect(result.cancelledAt).toBe(existingCancelledAt.toISOString());
      expect(repo.updateChallenge).not.toHaveBeenCalled();
    });
  });

  describe("Non-existent challenge", () => {
    it("throws 404 when challengeId does not exist", async () => {
      vi.mocked(repo.findChallengeById).mockResolvedValue(null);

      await expect(acceptChallenge(opponentCaptainId, "non-existent-id", now)).rejects.toThrow(
        new HttpError(404, "Challenge not found"),
      );
      await expect(declineChallenge(opponentCaptainId, "non-existent-id", now)).rejects.toThrow(
        new HttpError(404, "Challenge not found"),
      );
      await expect(cancelChallenge(challengerCaptainId, "non-existent-id", now)).rejects.toThrow(
        new HttpError(404, "Challenge not found"),
      );
    });
  });

  describe("expireDueChallenges", () => {
    it("expires due challenges and returns the count of expired rows", async () => {
      vi.mocked(repo.expireDueChallenges).mockResolvedValue({ count: 3 });

      const result = await expireDueChallenges(now);
      expect(result).toEqual({ count: 3 });
      expect(repo.expireDueChallenges).toHaveBeenCalledWith(now, undefined);
    });
  });
});
