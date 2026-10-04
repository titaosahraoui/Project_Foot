import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/error-handler";
import * as teamsService from "../teams/teams.service";
import * as matchmakingService from "./matchmaking.service";
import * as repo from "./matchmaking.repository";

const runId = randomUUID();
const password = "password123";

let captainId = "";
let memberId = "";
let outsiderId = "";
let otherCaptainId = "";

let teamId = "";
let otherTeamId = "";

const NOW = new Date("2026-11-01T10:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function makeInput(overrides: Record<string, unknown> = {}) {
  const start = NOW.getTime() + 10 * HOUR_MS;
  return {
    teamId,
    startAt: iso(start),
    endAt: iso(start + 90 * MINUTE_MS),
    format: "FIVE_A_SIDE" as const,
    origin: { lat: 36.7538, lng: 3.0588 },
    ...overrides,
  };
}

beforeAll(async () => {
  const [cap, mem, out, oCap] = await Promise.all([
    prisma.user.create({
      data: {
        email: `cap_${runId}@test.com`,
        passwordHash: password,
        displayName: "Captain",
      },
    }),
    prisma.user.create({
      data: {
        email: `mem_${runId}@test.com`,
        passwordHash: password,
        displayName: "Member",
      },
    }),
    prisma.user.create({
      data: {
        email: `out_${runId}@test.com`,
        passwordHash: password,
        displayName: "Outsider",
      },
    }),
    prisma.user.create({
      data: {
        email: `ocap_${runId}@test.com`,
        passwordHash: password,
        displayName: "Other Captain",
      },
    }),
  ]);

  captainId = cap.id;
  memberId = mem.id;
  outsiderId = out.id;
  otherCaptainId = oCap.id;

  const t1 = await teamsService.createTeam(captainId, {
    name: `Team Alpha ${runId}`,
  });
  teamId = t1.id;

  await prisma.teamMembership.create({
    data: {
      teamId,
      userId: memberId,
      role: "MEMBER",
      status: "ACTIVE",
    },
  });

  const t2 = await teamsService.createTeam(otherCaptainId, {
    name: `Team Beta ${runId}`,
  });
  otherTeamId = t2.id;
});

afterAll(async () => {
  await prisma.team.deleteMany({
    where: { id: { in: [teamId, otherTeamId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [captainId, memberId, outsiderId, otherCaptainId] } },
  });
  await prisma.$disconnect();
});

describe("createAvailability (lifecycle integration)", () => {
  it("allows the active captain to create availability and persists defaults", async () => {
    const input = makeInput();
    const created = await matchmakingService.createAvailability(
      captainId,
      input,
      NOW,
    );

    expect(created).toMatchObject({
      teamId,
      createdById: captainId,
      status: "OPEN",
      format: "FIVE_A_SIDE",
      radiusKm: 10,
      eloTolerance: 150,
      message: null,
      matchedAt: null,
      cancelledAt: null,
      approximateArea: { lat: 36.75, lng: 3.06 },
    });
    expect(created.startAt).toBe(input.startAt);
    expect(created.endAt).toBe(input.endAt);
    expect(created.expiresAt).toBe(input.startAt);

    // Private coordinate check
    const serialized = JSON.stringify(created);
    expect(serialized).not.toContain("36.7538");
    expect(serialized).not.toContain("3.0588");
    expect(serialized).not.toContain("originLat");
    expect(serialized).not.toContain("originLng");
  });

  it("forbids a regular team member from creating availability (403)", async () => {
    const input = makeInput({
      startAt: iso(NOW.getTime() + 15 * HOUR_MS),
      endAt: iso(NOW.getTime() + 16 * HOUR_MS + 30 * MINUTE_MS),
    });

    await expect(
      matchmakingService.createAvailability(memberId, input, NOW),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.createAvailability(memberId, input, NOW);
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
    }
  });

  it("forbids an unrelated user from creating availability for the team (403)", async () => {
    const input = makeInput({
      startAt: iso(NOW.getTime() + 15 * HOUR_MS),
      endAt: iso(NOW.getTime() + 16 * HOUR_MS + 30 * MINUTE_MS),
    });

    await expect(
      matchmakingService.createAvailability(outsiderId, input, NOW),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.createAvailability(outsiderId, input, NOW);
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
    }
  });

  it("rejects availability starting less than six hours in advance", async () => {
    const input = makeInput({
      startAt: iso(NOW.getTime() + 5 * HOUR_MS),
      endAt: iso(NOW.getTime() + 6 * HOUR_MS + 30 * MINUTE_MS),
    });

    await expect(
      matchmakingService.createAvailability(captainId, input, NOW),
    ).rejects.toThrow("Availability must start at least 6 hours from now");
  });

  it("rejects duration under 60 minutes", async () => {
    const start = NOW.getTime() + 8 * HOUR_MS;
    const input = makeInput({
      startAt: iso(start),
      endAt: iso(start + 45 * MINUTE_MS),
    });

    await expect(
      matchmakingService.createAvailability(captainId, input, NOW),
    ).rejects.toThrow("Availability must last between 60 and 240 minutes");
  });

  it("rejects duration over 240 minutes", async () => {
    const start = NOW.getTime() + 8 * HOUR_MS;
    const input = makeInput({
      startAt: iso(start),
      endAt: iso(start + 250 * MINUTE_MS),
    });

    await expect(
      matchmakingService.createAvailability(captainId, input, NOW),
    ).rejects.toThrow("Availability must last between 60 and 240 minutes");
  });

  it("prevents the team from creating an overlapping OPEN window (409)", async () => {
    // The first test created a window from NOW + 10h to NOW + 11.5h.
    // Try to create an overlapping window from NOW + 10.5h to NOW + 12h.
    const start = NOW.getTime() + 10 * HOUR_MS + 30 * MINUTE_MS;
    const input = makeInput({
      startAt: iso(start),
      endAt: iso(start + 90 * MINUTE_MS),
    });

    await expect(
      matchmakingService.createAvailability(captainId, input, NOW),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.createAvailability(captainId, input, NOW);
    } catch (err) {
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).message).toContain("overlapping");
    }
  });

  it("allows adjacent non-overlapping window for the same team", async () => {
    // Exact adjacent window: starts when the first one ends (NOW + 11.5h)
    const start = NOW.getTime() + 11 * HOUR_MS + 30 * MINUTE_MS;
    const input = makeInput({
      startAt: iso(start),
      endAt: iso(start + 90 * MINUTE_MS),
    });

    const created = await matchmakingService.createAvailability(
      captainId,
      input,
      NOW,
    );
    expect(created.status).toBe("OPEN");
  });

  it("allows another team to create an overlapping window", async () => {
    // Same time as team Alpha's first window, but for team Beta
    const start = NOW.getTime() + 10 * HOUR_MS;
    const input = makeInput({
      teamId: otherTeamId,
      startAt: iso(start),
      endAt: iso(start + 90 * MINUTE_MS),
    });

    const created = await matchmakingService.createAvailability(
      otherCaptainId,
      input,
      NOW,
    );
    expect(created.status).toBe("OPEN");
    expect(created.teamId).toBe(otherTeamId);
  });
});

describe("listMyAvailability (lifecycle integration)", () => {
  it("returns all team availabilities for captain with approximate area", async () => {
    const list = await matchmakingService.listMyAvailability(captainId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const item of list) {
      expect(item.teamId).toBe(teamId);
      expect(item.approximateArea).toBeDefined();
      expect(item).not.toHaveProperty("originLat");
      expect(item).not.toHaveProperty("originLng");
    }
  });

  it("returns team availabilities for a regular member as well", async () => {
    const list = await matchmakingService.listMyAvailability(memberId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const item of list) {
      expect(item.teamId).toBe(teamId);
      expect(item.approximateArea).toBeDefined();
      expect(item).not.toHaveProperty("originLat");
      expect(item).not.toHaveProperty("originLng");
    }
  });

  it("returns empty list for an unrelated user with no teams", async () => {
    const list = await matchmakingService.listMyAvailability(outsiderId);
    expect(list).toEqual([]);
  });
});

describe("cancelAvailability (lifecycle integration)", () => {
  let availabilityToCancelId = "";

  beforeAll(async () => {
    const start = NOW.getTime() + 30 * HOUR_MS;
    const created = await matchmakingService.createAvailability(
      captainId,
      makeInput({
        startAt: iso(start),
        endAt: iso(start + 90 * MINUTE_MS),
      }),
      NOW,
    );
    availabilityToCancelId = created.id;
  });

  it("forbids non-captain member from cancelling (403)", async () => {
    await expect(
      matchmakingService.cancelAvailability(
        memberId,
        availabilityToCancelId,
        NOW,
      ),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.cancelAvailability(
        memberId,
        availabilityToCancelId,
        NOW,
      );
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
    }
  });

  it("forbids unrelated user from cancelling (403)", async () => {
    await expect(
      matchmakingService.cancelAvailability(
        outsiderId,
        availabilityToCancelId,
        NOW,
      ),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.cancelAvailability(
        outsiderId,
        availabilityToCancelId,
        NOW,
      );
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
    }
  });

  it("throws 404 for unknown availability id", async () => {
    await expect(
      matchmakingService.cancelAvailability(captainId, randomUUID(), NOW),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.cancelAvailability(captainId, randomUUID(), NOW);
    } catch (err) {
      expect((err as HttpError).status).toBe(404);
    }
  });

  it("allows captain to cancel OPEN availability", async () => {
    const cancelTime = new Date(NOW.getTime() + 2 * HOUR_MS);
    const cancelled = await matchmakingService.cancelAvailability(
      captainId,
      availabilityToCancelId,
      cancelTime,
    );

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBe(cancelTime.toISOString());
  });

  it("is idempotent: repeated cancel on already CANCELLED returns current state", async () => {
    const cancelledAgain = await matchmakingService.cancelAvailability(
      captainId,
      availabilityToCancelId,
      new Date(NOW.getTime() + 5 * HOUR_MS),
    );

    expect(cancelledAgain.status).toBe("CANCELLED");
    // Cancelled timestamp does not change on repeated cancel
    expect(cancelledAgain.cancelledAt).toBe(
      new Date(NOW.getTime() + 2 * HOUR_MS).toISOString(),
    );
  });

  it("allows re-creating an availability in the window of a cancelled availability", async () => {
    const start = NOW.getTime() + 30 * HOUR_MS;
    const reCreated = await matchmakingService.createAvailability(
      captainId,
      makeInput({
        startAt: iso(start),
        endAt: iso(start + 90 * MINUTE_MS),
      }),
      NOW,
    );

    expect(reCreated.status).toBe("OPEN");
  });

  it("rejects cancellation of MATCHED availability with 409", async () => {
    const start = NOW.getTime() + 40 * HOUR_MS;
    const item = await matchmakingService.createAvailability(
      captainId,
      makeInput({
        startAt: iso(start),
        endAt: iso(start + 90 * MINUTE_MS),
      }),
      NOW,
    );

    // Simulate match agreement setting status to MATCHED
    await repo.updateAvailability(item.id, {
      status: "MATCHED",
      matchedAt: new Date(),
    });

    await expect(
      matchmakingService.cancelAvailability(captainId, item.id, NOW),
    ).rejects.toThrowError(HttpError);

    try {
      await matchmakingService.cancelAvailability(captainId, item.id, NOW);
    } catch (err) {
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).message).toContain("Matched");
    }
  });
});

describe("expireDueAvailability (lifecycle integration)", () => {
  let dueId = "";
  let futureId = "";

  beforeAll(async () => {
    const start = NOW.getTime() + 50 * HOUR_MS;
    const item1 = await matchmakingService.createAvailability(
      captainId,
      makeInput({
        startAt: iso(start),
        endAt: iso(start + 90 * MINUTE_MS),
      }),
      NOW,
    );
    dueId = item1.id;

    const startFuture = NOW.getTime() + 80 * HOUR_MS;
    const item2 = await matchmakingService.createAvailability(
      captainId,
      makeInput({
        startAt: iso(startFuture),
        endAt: iso(startFuture + 90 * MINUTE_MS),
      }),
      NOW,
    );
    futureId = item2.id;
  });

  it("expires availability when endAt/expiresAt is in the past", async () => {
    // Set clock to after item1 endAt, but before item2 startAt
    const clock = new Date(NOW.getTime() + 52 * HOUR_MS);

    const result = await matchmakingService.expireDueAvailability(clock);
    expect(result.count).toBeGreaterThanOrEqual(1);

    const foundDue = await repo.findAvailabilityById(dueId);
    expect(foundDue?.status).toBe("EXPIRED");

    const foundFuture = await repo.findAvailabilityById(futureId);
    expect(foundFuture?.status).toBe("OPEN");
  });

  it("is idempotent: repeated call with same clock returns 0 count", async () => {
    const clock = new Date(NOW.getTime() + 52 * HOUR_MS);
    const result = await matchmakingService.expireDueAvailability(clock);
    // Since item1 was already expired, count for due items is 0
    expect(result.count).toBe(0);
  });
});
