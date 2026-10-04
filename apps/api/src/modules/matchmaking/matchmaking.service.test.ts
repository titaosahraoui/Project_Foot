import type { TeamAvailability as TeamAvailabilityRecord } from "@prisma/client";
import {
  publicTeamAvailabilitySchema,
  teamAvailabilitySchema,
} from "@footconnect/shared";
import { describe, expect, it } from "vitest";
import { toPublicTeamAvailability, toTeamAvailability } from "./matchmaking.service";

const record: TeamAvailabilityRecord = {
  id: "6a1d3c0e-8b9f-4f1e-a1b2-3c4d5e6f7a8b",
  teamId: "0b6f7a52-6c43-4a8e-9a43-0c8f1f1d2b11",
  createdById: "c2a7e0f4-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
  startAt: new Date("2026-11-01T17:00:00.000Z"),
  endAt: new Date("2026-11-01T18:30:00.000Z"),
  format: "SEVEN_A_SIDE",
  originLat: 36.7538,
  originLng: 3.0588,
  radiusKm: 10,
  eloTolerance: 150,
  message: "Friendly but competitive",
  status: "OPEN",
  expiresAt: new Date("2026-11-01T17:00:00.000Z"),
  matchedAt: null,
  cancelledAt: null,
  createdAt: new Date("2026-10-04T12:00:00.000Z"),
  updatedAt: new Date("2026-10-04T12:00:00.000Z"),
};

describe("toTeamAvailability", () => {
  it("maps a record to the strict own-team contract with UTC ISO strings", () => {
    const view = toTeamAvailability(record);

    expect(teamAvailabilitySchema.parse(view)).toEqual(view);
    expect(view).toMatchObject({
      startAt: "2026-11-01T17:00:00.000Z",
      endAt: "2026-11-01T18:30:00.000Z",
      approximateArea: { lat: 36.75, lng: 3.06 },
      radiusKm: 10,
      eloTolerance: 150,
      matchedAt: null,
      cancelledAt: null,
    });
  });

  it("never exposes raw origin coordinates", () => {
    const serialized = JSON.stringify(toTeamAvailability(record));
    expect(serialized).not.toContain("originLat");
    expect(serialized).not.toContain("36.7538");
    expect(serialized).not.toContain("3.0588");
  });
});

describe("toPublicTeamAvailability", () => {
  it("maps to the strict public contract without private preferences", () => {
    const view = toPublicTeamAvailability(record);

    expect(publicTeamAvailabilitySchema.parse(view)).toEqual(view);
    expect(view).toEqual({
      id: record.id,
      teamId: record.teamId,
      startAt: "2026-11-01T17:00:00.000Z",
      endAt: "2026-11-01T18:30:00.000Z",
      format: "SEVEN_A_SIDE",
      approximateArea: { lat: 36.75, lng: 3.06 },
      message: "Friendly but competitive",
    });
  });
});
