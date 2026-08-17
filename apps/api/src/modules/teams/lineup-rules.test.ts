import { describe, expect, it } from "vitest";
import { HttpError } from "../../middleware/error-handler";
import { validateLineup } from "./lineup-rules";

describe("lineup-rules", () => {
  const members5 = ["u1", "u2", "u3", "u4", "u5"];
  const activeMembers5 = new Set(members5);

  const members7 = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"];
  const activeMembers7 = new Set(members7);

  const members11 = [
    "u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10", "u11",
  ];
  const activeMembers11 = new Set(members11);

  describe("5v5 (FIVE_A_SIDE)", () => {
    it("accepts a valid 5v5 lineup", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
              { userId: "u5", positionCode: "ST", sortOrder: 4 },
            ],
          },
          activeMembers5,
        ),
      ).not.toThrow();
    });

    it("rejects an invalid formation code", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "2-1-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
              { userId: "u5", positionCode: "ST", sortOrder: 4 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow(HttpError);
    });

    it("rejects incorrect player count", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow("requires exactly 5 players");
    });

    it("rejects non-active team member", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
              { userId: "u-unknown", positionCode: "ST", sortOrder: 4 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow("not an active member");
    });

    it("rejects duplicate player in slots", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u1", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
              { userId: "u5", positionCode: "ST", sortOrder: 4 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow("Duplicate player");
    });

    it("rejects lineup with no GK", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "LB", sortOrder: 0 },
              { userId: "u2", positionCode: "RB", sortOrder: 1 },
              { userId: "u3", positionCode: "CM", sortOrder: 2 },
              { userId: "u4", positionCode: "ST", sortOrder: 3 },
              { userId: "u5", positionCode: "LB", sortOrder: 4 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow();
    });

    it("rejects invalid position code for formation", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
              { userId: "u5", positionCode: "LCB", sortOrder: 4 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow("Invalid position code 'LCB'");
    });

    it("rejects non-contiguous sort orders", () => {
      expect(() =>
        validateLineup(
          "FIVE_A_SIDE",
          {
            formationCode: "1-2-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "RB", sortOrder: 2 },
              { userId: "u4", positionCode: "CM", sortOrder: 3 },
              { userId: "u5", positionCode: "ST", sortOrder: 5 },
            ],
          },
          activeMembers5,
        ),
      ).toThrow("Invalid sort order 5");
    });
  });

  describe("7v7 (SEVEN_A_SIDE)", () => {
    it("accepts a valid 7v7 lineup (2-3-1)", () => {
      expect(() =>
        validateLineup(
          "SEVEN_A_SIDE",
          {
            formationCode: "2-3-1",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LCB", sortOrder: 1 },
              { userId: "u3", positionCode: "RCB", sortOrder: 2 },
              { userId: "u4", positionCode: "LM", sortOrder: 3 },
              { userId: "u5", positionCode: "CM", sortOrder: 4 },
              { userId: "u6", positionCode: "RM", sortOrder: 5 },
              { userId: "u7", positionCode: "ST", sortOrder: 6 },
            ],
          },
          activeMembers7,
        ),
      ).not.toThrow();
    });
  });

  describe("11v11 (ELEVEN_A_SIDE)", () => {
    it("accepts a valid 11v11 lineup (4-4-2)", () => {
      expect(() =>
        validateLineup(
          "ELEVEN_A_SIDE",
          {
            formationCode: "4-4-2",
            slots: [
              { userId: "u1", positionCode: "GK", sortOrder: 0 },
              { userId: "u2", positionCode: "LB", sortOrder: 1 },
              { userId: "u3", positionCode: "LCB", sortOrder: 2 },
              { userId: "u4", positionCode: "RCB", sortOrder: 3 },
              { userId: "u5", positionCode: "RB", sortOrder: 4 },
              { userId: "u6", positionCode: "LM", sortOrder: 5 },
              { userId: "u7", positionCode: "LCM", sortOrder: 6 },
              { userId: "u8", positionCode: "RCM", sortOrder: 7 },
              { userId: "u9", positionCode: "RM", sortOrder: 8 },
              { userId: "u10", positionCode: "LST", sortOrder: 9 },
              { userId: "u11", positionCode: "RST", sortOrder: 10 },
            ],
          },
          activeMembers11,
        ),
      ).not.toThrow();
    });
  });
});
