import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { withTransaction } from "../../lib/transaction";
import * as repo from "./matchmaking.repository";

// Fixture rows are created directly; the matchmaking repository itself only
// touches the team_availabilities table it owns.
const runId = randomUUID();
let userId = "";
let teamId = "";
let otherTeamId = "";

const startAt = new Date("2026-11-01T17:00:00.000Z");
const endAt = new Date("2026-11-01T18:30:00.000Z");

function baseRecord(
  overrides: Partial<repo.CreateAvailabilityRecord> = {},
): repo.CreateAvailabilityRecord {
  return {
    teamId,
    createdById: userId,
    startAt,
    endAt,
    format: "FIVE_A_SIDE",
    originLat: 36.7538,
    originLng: 3.0588,
    expiresAt: startAt,
    ...overrides,
  };
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `availability_${runId}@test.com`,
      passwordHash: "not-a-real-hash",
      displayName: "Availability Captain",
    },
  });
  userId = user.id;
  const [team, otherTeam] = await Promise.all([
    prisma.team.create({ data: { name: `Availability FC ${runId}` } }),
    prisma.team.create({ data: { name: `Other FC ${runId}` } }),
  ]);
  teamId = team.id;
  otherTeamId = otherTeam.id;
});

afterAll(async () => {
  await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("team_availabilities migration (integration)", () => {
  it("creates the MatchFormat and AvailabilityStatus Postgres enums", async () => {
    const rows = await prisma.$queryRaw<{ type: string; label: string }[]>`
      SELECT t.typname AS type, e.enumlabel AS label
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('MatchFormat', 'AvailabilityStatus')
      ORDER BY t.typname, e.enumsortorder
    `;
    const byType = (type: string) =>
      rows.filter((r) => r.type === type).map((r) => r.label);

    expect(byType("AvailabilityStatus")).toEqual([
      "OPEN",
      "MATCHED",
      "CANCELLED",
      "EXPIRED",
    ]);
    expect(byType("MatchFormat")).toEqual([
      "FIVE_A_SIDE",
      "SEVEN_A_SIDE",
      "ELEVEN_A_SIDE",
    ]);
  });

  it.each([
    ["radius below 1 km", { radiusKm: 0 }],
    ["radius above 50 km", { radiusKm: 51 }],
    ["Elo tolerance below 50", { eloTolerance: 49 }],
    ["Elo tolerance above 500", { eloTolerance: 501 }],
    ["latitude out of range", { originLat: 90.5 }],
    ["longitude out of range", { originLng: -180.5 }],
    ["end not after start", { endAt: startAt }],
    ["message longer than 280", { message: "x".repeat(281) }],
  ] as const)("rejects %s at the database level", async (_label, overrides) => {
    await expect(repo.createAvailability(baseRecord(overrides))).rejects.toThrow();
  });

  it("rejects overlapping OPEN availability for the same team at the database level", async () => {
    const windowStart = new Date("2026-12-01T10:00:00.000Z");
    const windowEnd = new Date("2026-12-01T12:00:00.000Z");

    const first = await repo.createAvailability(
      baseRecord({ startAt: windowStart, endAt: windowEnd, expiresAt: windowStart }),
    );

    // Overlapping window for the same team
    const overlapStart = new Date("2026-12-01T11:00:00.000Z");
    const overlapEnd = new Date("2026-12-01T13:00:00.000Z");

    await expect(
      repo.createAvailability(
        baseRecord({ startAt: overlapStart, endAt: overlapEnd, expiresAt: overlapStart }),
      ),
    ).rejects.toThrow();

    // Clean up
    await prisma.teamAvailability.deleteMany({ where: { id: first.id } });
  });
});

describe("matchmaking repository (integration)", () => {
  it("persists defaults: OPEN, 10 km, ±150 Elo, null lifecycle timestamps", async () => {
    const created = await repo.createAvailability(baseRecord());

    expect(created).toMatchObject({
      teamId,
      createdById: userId,
      format: "FIVE_A_SIDE",
      status: "OPEN",
      radiusKm: 10,
      eloTolerance: 150,
      message: null,
      matchedAt: null,
      cancelledAt: null,
      originLat: 36.7538,
      originLng: 3.0588,
    });
    expect(created.startAt.toISOString()).toBe("2026-11-01T17:00:00.000Z");
    expect(created.endAt.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    expect(created.expiresAt.toISOString()).toBe("2026-11-01T17:00:00.000Z");
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it.each([
    ["FIVE_A_SIDE", 1],
    ["SEVEN_A_SIDE", 2],
    ["ELEVEN_A_SIDE", 3],
  ] as const)(
    "round-trips the %s format enum",
    async (format, dayOffset) => {
      const start = new Date(startAt.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const end = new Date(endAt.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const created = await repo.createAvailability(
        baseRecord({
          format,
          startAt: start,
          endAt: end,
          expiresAt: start,
          radiusKm: 50,
          eloTolerance: 500,
          message: "Bring bibs",
        }),
      );
      const found = await repo.findAvailabilityById(created.id);

      expect(found).toMatchObject({
        format,
        radiusKm: 50,
        eloTolerance: 500,
        message: "Bring bibs",
      });
    },
  );

  it("returns null for an unknown id", async () => {
    await expect(repo.findAvailabilityById(randomUUID())).resolves.toBeNull();
  });

  it("lists by team and status ordered by start time", async () => {
    const later = await repo.createAvailability(
      baseRecord({
        teamId: otherTeamId,
        startAt: new Date("2026-11-03T17:00:00.000Z"),
        endAt: new Date("2026-11-03T18:00:00.000Z"),
      }),
    );
    const earlier = await repo.createAvailability(
      baseRecord({
        teamId: otherTeamId,
        startAt: new Date("2026-11-02T17:00:00.000Z"),
        endAt: new Date("2026-11-02T18:00:00.000Z"),
      }),
    );
    const cancelled = await repo.createAvailability(
      baseRecord({
        teamId: otherTeamId,
        startAt: new Date("2026-11-01T17:00:00.000Z"),
        endAt: new Date("2026-11-01T18:00:00.000Z"),
        expiresAt: new Date("2026-11-01T17:00:00.000Z"),
      }),
    );
    await repo.updateAvailability(cancelled.id, {
      status: "CANCELLED",
      cancelledAt: new Date(),
    });

    const all = await repo.listAvailabilityByTeams([otherTeamId]);
    expect(all.map((a) => a.id)).toEqual([cancelled.id, earlier.id, later.id]);

    const open = await repo.listAvailabilityByTeams([otherTeamId], {
      statuses: ["OPEN"],
    });
    expect(open.map((a) => a.id)).toEqual([earlier.id, later.id]);

    await expect(repo.listAvailabilityByTeams([])).resolves.toEqual([]);
  });

  it("updates lifecycle fields and bumps updatedAt", async () => {
    const start = new Date("2026-11-10T17:00:00.000Z");
    const end = new Date("2026-11-10T18:30:00.000Z");
    const created = await repo.createAvailability(
      baseRecord({ startAt: start, endAt: end, expiresAt: start }),
    );
    const matchedAt = new Date("2026-10-20T10:00:00.000Z");

    const updated = await repo.updateAvailability(created.id, {
      status: "MATCHED",
      matchedAt,
    });

    expect(updated.status).toBe("MATCHED");
    expect(updated.matchedAt?.toISOString()).toBe(matchedAt.toISOString());
    expect(updated.cancelledAt).toBeNull();
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );
  });

  it("participates in a caller-provided transaction", async () => {
    const start = new Date("2026-11-12T17:00:00.000Z");
    const end = new Date("2026-11-12T18:30:00.000Z");
    let createdId = "";
    await expect(
      withTransaction(async (tx) => {
        const created = await repo.createAvailability(
          baseRecord({ startAt: start, endAt: end, expiresAt: start }),
          tx,
        );
        createdId = created.id;
        await expect(repo.findAvailabilityById(created.id, tx)).resolves.not.toBeNull();
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    await expect(repo.findAvailabilityById(createdId)).resolves.toBeNull();
  });

  it("cascades availability deletion with its team", async () => {
    const team = await prisma.team.create({ data: { name: `Cascade FC ${runId}` } });
    const created = await repo.createAvailability(baseRecord({ teamId: team.id }));

    await prisma.team.delete({ where: { id: team.id } });

    await expect(repo.findAvailabilityById(created.id)).resolves.toBeNull();
  });
});
