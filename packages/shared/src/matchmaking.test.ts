import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_DEFAULT_ELO_TOLERANCE,
  AVAILABILITY_DEFAULT_RADIUS_KM,
  approximateAreaSchema,
  availabilityStatusSchema,
  buildCreateTeamAvailabilitySchema,
  buildUpdateTeamAvailabilitySchema,
  createTeamAvailabilitySchema,
  publicTeamAvailabilitySchema,
  teamAvailabilitySchema,
  toApproximateArea,
  updateTeamAvailabilitySchema,
} from "./index";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TEAM_ID = "0b6f7a52-6c43-4a8e-9a43-0c8f1f1d2b11";
const AVAILABILITY_ID = "6a1d3c0e-8b9f-4f1e-a1b2-3c4d5e6f7a8b";
const USER_ID = "c2a7e0f4-1b3d-4e5f-8a9b-0c1d2e3f4a5b";

const schema = buildCreateTeamAvailabilitySchema(() => NOW);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** A valid 90-minute window starting exactly 24 hours after NOW, in Algiers. */
function validInput(overrides: Record<string, unknown> = {}) {
  const start = NOW.getTime() + 24 * HOUR_MS;
  return {
    teamId: TEAM_ID,
    startAt: iso(start),
    endAt: iso(start + 90 * MINUTE_MS),
    format: "FIVE_A_SIDE",
    origin: { lat: 36.7538, lng: 3.0588 },
    ...overrides,
  };
}

function windowInput(leadMs: number, durationMinutes: number) {
  const start = NOW.getTime() + leadMs;
  return validInput({
    startAt: iso(start),
    endAt: iso(start + durationMinutes * MINUTE_MS),
  });
}

describe("availabilityStatusSchema", () => {
  it("accepts exactly the canonical lifecycle states", () => {
    expect(availabilityStatusSchema.options).toEqual([
      "OPEN",
      "MATCHED",
      "CANCELLED",
      "EXPIRED",
    ]);
  });
});

describe("createTeamAvailabilitySchema defaults", () => {
  it("defaults the radius to 10 km and the Elo tolerance to ±150", () => {
    const parsed = schema.parse(validInput());
    expect(AVAILABILITY_DEFAULT_RADIUS_KM).toBe(10);
    expect(AVAILABILITY_DEFAULT_ELO_TOLERANCE).toBe(150);
    expect(parsed.radiusKm).toBe(10);
    expect(parsed.eloTolerance).toBe(150);
    expect(parsed.message).toBeUndefined();
  });

  it("exposes a default instance that validates against the real clock", () => {
    const start = Date.now() + 7 * HOUR_MS;
    const parsed = createTeamAvailabilitySchema.safeParse(
      validInput({ startAt: iso(start), endAt: iso(start + 60 * MINUTE_MS) }),
    );
    expect(parsed.success).toBe(true);
  });
});

describe("createTeamAvailabilitySchema window", () => {
  it.each([60, 240])("accepts a %i-minute duration", (minutes) => {
    expect(schema.safeParse(windowInput(24 * HOUR_MS, minutes)).success).toBe(
      true,
    );
  });

  it.each([59, 241, 0, -30])("rejects a %i-minute duration", (minutes) => {
    const result = schema.safeParse(windowInput(24 * HOUR_MS, minutes));
    expect(result.success).toBe(false);
  });

  it("accepts a start exactly six hours ahead", () => {
    expect(schema.safeParse(windowInput(6 * HOUR_MS, 60)).success).toBe(true);
  });

  it("rejects a start one millisecond short of six hours ahead", () => {
    const result = schema.safeParse(windowInput(6 * HOUR_MS - 1, 60));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join("."))).toContain(
        "startAt",
      );
    }
  });

  it("rejects a start in the past", () => {
    expect(schema.safeParse(windowInput(-HOUR_MS, 60)).success).toBe(false);
  });

  it("accepts offset timestamps and compares them as UTC instants", () => {
    // 2026-10-05T19:00+01:00 is 18:00Z, i.e. 30 hours after NOW.
    const result = schema.safeParse(
      validInput({
        startAt: "2026-10-05T19:00:00+01:00",
        endAt: "2026-10-05T20:30:00+01:00",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects timestamps without an explicit timezone", () => {
    const result = schema.safeParse(
      validInput({
        startAt: "2026-10-05T18:00:00",
        endAt: "2026-10-05T19:30:00",
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe("createTeamAvailabilitySchema matching preferences", () => {
  it.each([1, 50])("accepts radius %i km", (radiusKm) => {
    expect(schema.parse(validInput({ radiusKm })).radiusKm).toBe(radiusKm);
  });

  it.each([0, 0.5, 51, 10.5])("rejects radius %s km", (radiusKm) => {
    expect(schema.safeParse(validInput({ radiusKm })).success).toBe(false);
  });

  it.each([50, 500])("accepts Elo tolerance %i", (eloTolerance) => {
    expect(schema.parse(validInput({ eloTolerance })).eloTolerance).toBe(
      eloTolerance,
    );
  });

  it.each([49, 501, 150.5])("rejects Elo tolerance %s", (eloTolerance) => {
    expect(schema.safeParse(validInput({ eloTolerance })).success).toBe(false);
  });

  it.each(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"])(
    "accepts format %s",
    (format) => {
      expect(schema.parse(validInput({ format })).format).toBe(format);
    },
  );

  it("rejects an unsupported format", () => {
    expect(
      schema.safeParse(validInput({ format: "NINE_A_SIDE" })).success,
    ).toBe(false);
  });

  it("accepts a 280-character message", () => {
    const message = "x".repeat(280);
    expect(schema.parse(validInput({ message })).message).toBe(message);
  });

  it("rejects a 281-character message", () => {
    expect(
      schema.safeParse(validInput({ message: "x".repeat(281) })).success,
    ).toBe(false);
  });

  it("rejects a non-UUID team id", () => {
    expect(schema.safeParse(validInput({ teamId: "team-1" })).success).toBe(
      false,
    );
  });
});

describe("createTeamAvailabilitySchema origin", () => {
  it.each([
    { lat: 90, lng: 180 },
    { lat: -90, lng: -180 },
  ])("accepts boundary origin $lat, $lng", (origin) => {
    expect(schema.parse(validInput({ origin })).origin).toEqual(origin);
  });

  it.each([
    { lat: 90.0001, lng: 3 },
    { lat: -90.0001, lng: 3 },
    { lat: 36, lng: 180.0001 },
    { lat: 36, lng: -180.0001 },
  ])("rejects out-of-range origin $lat, $lng", (origin) => {
    expect(schema.safeParse(validInput({ origin })).success).toBe(false);
  });

  it("requires the creator to provide an origin", () => {
    const { origin: _origin, ...withoutOrigin } = validInput();
    expect(schema.safeParse(withoutOrigin).success).toBe(false);
  });
});

describe("approximate public area", () => {
  it("rounds an origin to two decimals (~1.1 km)", () => {
    expect(toApproximateArea({ lat: 36.7538, lng: 3.0588 })).toEqual({
      lat: 36.75,
      lng: 3.06,
    });
  });

  it("accepts a rounded area", () => {
    expect(approximateAreaSchema.safeParse({ lat: 36.75, lng: 3.06 }).success).toBe(
      true,
    );
  });

  it("rejects raw high-precision coordinates", () => {
    expect(
      approximateAreaSchema.safeParse({ lat: 36.7538, lng: 3.0588 }).success,
    ).toBe(false);
  });
});

describe("availability response schemas", () => {
  const ownView = {
    id: AVAILABILITY_ID,
    teamId: TEAM_ID,
    createdById: USER_ID,
    startAt: "2026-10-05T18:00:00.000Z",
    endAt: "2026-10-05T19:30:00.000Z",
    format: "FIVE_A_SIDE",
    approximateArea: { lat: 36.75, lng: 3.06 },
    radiusKm: 10,
    eloTolerance: 150,
    message: null,
    status: "OPEN",
    expiresAt: "2026-10-05T18:00:00.000Z",
    matchedAt: null,
    cancelledAt: null,
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };

  it("accepts the team's own availability view", () => {
    expect(teamAvailabilitySchema.parse(ownView)).toEqual(ownView);
  });

  it.each([
    { origin: { lat: 36.7538, lng: 3.0588 } },
    { originLat: 36.7538, originLng: 3.0588 },
  ])("rejects raw origin coordinates in the own view", (raw) => {
    expect(teamAvailabilitySchema.safeParse({ ...ownView, ...raw }).success).toBe(
      false,
    );
  });

  const publicView = {
    id: AVAILABILITY_ID,
    teamId: TEAM_ID,
    startAt: "2026-10-05T18:00:00.000Z",
    endAt: "2026-10-05T19:30:00.000Z",
    format: "SEVEN_A_SIDE",
    approximateArea: { lat: 36.75, lng: 3.06 },
    message: "Friendly but competitive",
  };

  it("accepts the public opponent view", () => {
    expect(publicTeamAvailabilitySchema.parse(publicView)).toEqual(publicView);
  });

  it.each([
    { originLat: 36.7538, originLng: 3.0588 },
    { createdById: USER_ID },
    { radiusKm: 10 },
    { eloTolerance: 150 },
  ])("rejects private fields in the public view: %o", (extra) => {
    expect(
      publicTeamAvailabilitySchema.safeParse({ ...publicView, ...extra }).success,
    ).toBe(false);
  });
});

describe("updateTeamAvailabilitySchema", () => {
  const updateSchema = buildUpdateTeamAvailabilitySchema(() => NOW);

  it("exports a default updateTeamAvailabilitySchema", () => {
    const parsed = updateTeamAvailabilitySchema.parse({ radiusKm: 20 });
    expect(parsed.radiusKm).toBe(20);
  });

  it("accepts partial updates to radius and elo tolerance", () => {
    const parsed = updateSchema.parse({
      radiusKm: 25,
      eloTolerance: 200,
    });
    expect(parsed.radiusKm).toBe(25);
    expect(parsed.eloTolerance).toBe(200);
  });

  it("accepts format and message updates", () => {
    const parsed = updateSchema.parse({
      format: "SEVEN_A_SIDE",
      message: "Looking for friendly competitive squads",
    });
    expect(parsed.format).toBe("SEVEN_A_SIDE");
    expect(parsed.message).toBe("Looking for friendly competitive squads");
  });

  it("accepts updating startAt and endAt with valid duration", () => {
    const start = iso(NOW.getTime() + 24 * HOUR_MS);
    const end = iso(NOW.getTime() + 24 * HOUR_MS + 90 * MINUTE_MS);
    const parsed = updateSchema.parse({
      startAt: start,
      endAt: end,
    });
    expect(parsed.startAt).toBe(start);
    expect(parsed.endAt).toBe(end);
  });

  it("rejects duration under 60 minutes when updating both times", () => {
    const start = iso(NOW.getTime() + 24 * HOUR_MS);
    const end = iso(NOW.getTime() + 24 * HOUR_MS + 45 * MINUTE_MS);
    const result = updateSchema.safeParse({
      startAt: start,
      endAt: end,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid radiusKm or eloTolerance", () => {
    expect(updateSchema.safeParse({ radiusKm: 0 }).success).toBe(false);
    expect(updateSchema.safeParse({ radiusKm: 55 }).success).toBe(false);
    expect(updateSchema.safeParse({ eloTolerance: 20 }).success).toBe(false);
    expect(updateSchema.safeParse({ eloTolerance: 600 }).success).toBe(false);
  });
});
