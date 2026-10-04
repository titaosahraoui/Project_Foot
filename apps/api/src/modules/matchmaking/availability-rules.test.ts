import { describe, expect, it } from "vitest";
import { HttpError } from "../../middleware/error-handler";
import {
  assertCanCancelAvailability,
  assertNoOpenOverlap,
  hasWindowOverlap,
  isAvailabilityDue,
} from "./availability-rules";

describe("hasWindowOverlap", () => {
  const base = {
    startAt: new Date("2026-11-01T12:00:00Z"),
    endAt: new Date("2026-11-01T14:00:00Z"),
  };

  it("returns true for identical windows", () => {
    expect(hasWindowOverlap(base, { ...base })).toBe(true);
  });

  it("returns true for partial overlap (starts before, ends during)", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-01T11:00:00Z"),
        endAt: new Date("2026-11-01T13:00:00Z"),
      }),
    ).toBe(true);
  });

  it("returns true for partial overlap (starts during, ends after)", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-01T13:00:00Z"),
        endAt: new Date("2026-11-01T15:00:00Z"),
      }),
    ).toBe(true);
  });

  it("returns true for complete containment (enclosing)", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-01T10:00:00Z"),
        endAt: new Date("2026-11-01T16:00:00Z"),
      }),
    ).toBe(true);
  });

  it("returns true for complete containment (enclosed)", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-01T12:30:00Z"),
        endAt: new Date("2026-11-01T13:30:00Z"),
      }),
    ).toBe(true);
  });

  it("returns false for adjacent window immediately before (touching end to start)", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-01T10:00:00Z"),
        endAt: new Date("2026-11-01T12:00:00Z"),
      }),
    ).toBe(false);
  });

  it("returns false for adjacent window immediately after (touching start to end)", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-01T14:00:00Z"),
        endAt: new Date("2026-11-01T16:00:00Z"),
      }),
    ).toBe(false);
  });

  it("returns false for completely disjoint windows", () => {
    expect(
      hasWindowOverlap(base, {
        startAt: new Date("2026-11-02T12:00:00Z"),
        endAt: new Date("2026-11-02T14:00:00Z"),
      }),
    ).toBe(false);
  });
});

describe("assertNoOpenOverlap", () => {
  const candidate = {
    startAt: new Date("2026-11-01T12:00:00Z"),
    endAt: new Date("2026-11-01T14:00:00Z"),
  };

  it("passes when existing list is empty", () => {
    expect(() => assertNoOpenOverlap(candidate, [])).not.toThrow();
  });

  it("passes when overlapping items are CANCELLED, EXPIRED, or MATCHED", () => {
    const existing = [
      {
        id: "1",
        startAt: new Date("2026-11-01T11:00:00Z"),
        endAt: new Date("2026-11-01T13:00:00Z"),
        status: "CANCELLED" as const,
      },
      {
        id: "2",
        startAt: new Date("2026-11-01T13:00:00Z"),
        endAt: new Date("2026-11-01T15:00:00Z"),
        status: "EXPIRED" as const,
      },
      {
        id: "3",
        startAt: new Date("2026-11-01T12:00:00Z"),
        endAt: new Date("2026-11-01T14:00:00Z"),
        status: "MATCHED" as const,
      },
    ];
    expect(() => assertNoOpenOverlap(candidate, existing)).not.toThrow();
  });

  it("throws 409 conflict when an OPEN window overlaps", () => {
    const existing = [
      {
        id: "1",
        startAt: new Date("2026-11-01T13:00:00Z"),
        endAt: new Date("2026-11-01T15:00:00Z"),
        status: "OPEN" as const,
      },
    ];
    expect(() => assertNoOpenOverlap(candidate, existing)).toThrowError(HttpError);
    try {
      assertNoOpenOverlap(candidate, existing);
    } catch (err) {
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).message).toContain("overlapping");
    }
  });

  it("ignores self when excludeId is provided", () => {
    const existing = [
      {
        id: "candidate-id",
        startAt: new Date("2026-11-01T12:00:00Z"),
        endAt: new Date("2026-11-01T14:00:00Z"),
        status: "OPEN" as const,
      },
    ];
    expect(() => assertNoOpenOverlap(candidate, existing, "candidate-id")).not.toThrow();
  });
});

describe("assertCanCancelAvailability", () => {
  it("allows cancelling OPEN availability", () => {
    expect(() => assertCanCancelAvailability("OPEN")).not.toThrow();
  });

  it("allows idempotent cancel for CANCELLED or EXPIRED availability", () => {
    expect(() => assertCanCancelAvailability("CANCELLED")).not.toThrow();
    expect(() => assertCanCancelAvailability("EXPIRED")).not.toThrow();
  });

  it("rejects cancellation of MATCHED availability with 409", () => {
    expect(() => assertCanCancelAvailability("MATCHED")).toThrowError(HttpError);
    try {
      assertCanCancelAvailability("MATCHED");
    } catch (err) {
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).message).toContain("Matched");
    }
  });
});

describe("isAvailabilityDue", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("returns true when OPEN and endAt is in the past", () => {
    expect(
      isAvailabilityDue(
        {
          status: "OPEN",
          startAt: new Date("2026-11-01T08:00:00Z"),
          endAt: new Date("2026-11-01T10:00:00Z"),
          expiresAt: new Date("2026-11-01T15:00:00Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("returns true when OPEN and expiresAt is in the past", () => {
    expect(
      isAvailabilityDue(
        {
          status: "OPEN",
          startAt: new Date("2026-11-01T11:00:00Z"),
          endAt: new Date("2026-11-01T13:00:00Z"),
          expiresAt: new Date("2026-11-01T11:00:00Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("returns true when OPEN and exactly at now", () => {
    expect(
      isAvailabilityDue(
        {
          status: "OPEN",
          startAt: new Date("2026-11-01T10:00:00Z"),
          endAt: now,
          expiresAt: new Date("2026-11-01T14:00:00Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("returns false when OPEN and both endAt and expiresAt are in the future", () => {
    expect(
      isAvailabilityDue(
        {
          status: "OPEN",
          startAt: new Date("2026-11-01T14:00:00Z"),
          endAt: new Date("2026-11-01T16:00:00Z"),
          expiresAt: new Date("2026-11-01T14:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns false when not OPEN even if past", () => {
    expect(
      isAvailabilityDue(
        {
          status: "CANCELLED",
          startAt: new Date("2026-11-01T08:00:00Z"),
          endAt: new Date("2026-11-01T10:00:00Z"),
          expiresAt: new Date("2026-11-01T08:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isAvailabilityDue(
        {
          status: "MATCHED",
          startAt: new Date("2026-11-01T08:00:00Z"),
          endAt: new Date("2026-11-01T10:00:00Z"),
          expiresAt: new Date("2026-11-01T08:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });
});
