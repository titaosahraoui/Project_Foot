import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { HttpError } from "../middleware/error-handler";
import {
  hashIdempotencyRequest,
  storeIdempotentResult,
} from "./idempotency";
import { prisma } from "./prisma";
import { withTransaction } from "./transaction";

const actorId = `idempotency-test-${randomUUID()}`;

afterAll(async () => {
  await prisma.$executeRaw`DELETE FROM "idempotency_records" WHERE "actorId" = ${actorId}`;
  await prisma.$disconnect();
});

describe("IdempotencyRecord uniqueness (integration)", () => {
  it("rejects one of two concurrent inserts with the same actor, scope, and key", async () => {
    const scope = "challenge:create";
    const key = `challenge-${randomUUID()}`;
    const expiresAt = new Date("2026-08-12T12:00:00Z");
    const insert = (id: string) => prisma.$executeRaw`
      INSERT INTO "idempotency_records" (
        "id", "actorId", "scope", "key", "requestHash", "resourceType", "resourceId",
        "responseStatus", "responseBody", "createdAt", "expiresAt"
      ) VALUES (
        ${id}, ${actorId}, ${scope}, ${key}, ${"request-hash"}, ${"challenge"},
        ${"challenge-01"}, ${201}, ${JSON.stringify({ id: "challenge-01" })}::jsonb,
        NOW(), ${expiresAt}
      )
    `;

    const results = await Promise.allSettled([
      insert(randomUUID()),
      insert(randomUUID()),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("replays one result for concurrent transactions with the same request", async () => {
    const scope = "challenge:create";
    const key = `same-request-${randomUUID()}`;
    const requestHash = hashIdempotencyRequest({ opponentId: "team-02" });
    const input = {
      actorId,
      scope,
      key,
      requestHash,
      resourceType: "challenge",
      resourceId: "challenge-same",
      responseStatus: 201,
      responseBody: { id: "challenge-same" },
      expiresAt: new Date("2026-08-13T12:00:00Z"),
    };

    const results = await Promise.all([
      withTransaction((tx) => storeIdempotentResult(input, tx)),
      withTransaction((tx) => storeIdempotentResult(input, tx)),
    ]);

    expect(results).toEqual([results[0], results[0]]);
    await expect(
      prisma.idempotencyRecord.count({ where: { actorId, scope, key } }),
    ).resolves.toBe(1);
  });

  it("returns one conflict for concurrent transactions with different requests", async () => {
    const scope = "challenge:create";
    const key = `different-request-${randomUUID()}`;
    const baseInput = {
      actorId,
      scope,
      key,
      resourceType: "challenge",
      responseStatus: 201,
      expiresAt: new Date("2026-08-13T12:00:00Z"),
    };

    const results = await Promise.allSettled([
      withTransaction((tx) =>
        storeIdempotentResult(
          {
            ...baseInput,
            requestHash: hashIdempotencyRequest({ opponentId: "team-02" }),
            resourceId: "challenge-first",
            responseBody: { id: "challenge-first" },
          },
          tx,
        ),
      ),
      withTransaction((tx) =>
        storeIdempotentResult(
          {
            ...baseInput,
            requestHash: hashIdempotencyRequest({ opponentId: "team-03" }),
            resourceId: "challenge-second",
            responseBody: { id: "challenge-second" },
          },
          tx,
        ),
      ),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result) => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: expect.any(HttpError),
    });
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    await expect(
      prisma.idempotencyRecord.count({ where: { actorId, scope, key } }),
    ).resolves.toBe(1);
  });
});
