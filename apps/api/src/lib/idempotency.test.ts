import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashIdempotencyRequest,
  readIdempotentResult,
  storeIdempotentResult,
} from "./idempotency";

const { createManyMock, findUniqueMock } = vi.hoisted(() => ({
  createManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    idempotencyRecord: {
      createMany: createManyMock,
      findUnique: findUniqueMock,
    },
  },
}));

const storedRecord = {
  id: "record-01",
  actorId: "captain-01",
  scope: "challenge:create",
  key: "challenge-request-01",
  requestHash: hashIdempotencyRequest({ opponentId: "team-02" }),
  resourceType: "challenge",
  resourceId: "challenge-01",
  responseStatus: 201,
  responseBody: { id: "challenge-01", status: "PENDING" },
  createdAt: new Date("2026-08-11T12:00:00Z"),
  expiresAt: new Date("2026-08-12T12:00:00Z"),
};

describe("hashIdempotencyRequest", () => {
  it("produces the same SHA-256 hash for recursively reordered object keys", () => {
    const first = {
      opponent: { id: "team-02", format: "SEVEN_A_SIDE" },
      windows: [{ start: "2026-08-11T18:00:00Z", end: "2026-08-11T19:00:00Z" }],
    };
    const second = {
      windows: [{ end: "2026-08-11T19:00:00Z", start: "2026-08-11T18:00:00Z" }],
      opponent: { format: "SEVEN_A_SIDE", id: "team-02" },
    };

    expect(hashIdempotencyRequest(first)).toBe(hashIdempotencyRequest(second));
    expect(hashIdempotencyRequest(first)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("storeIdempotentResult", () => {
  beforeEach(() => {
    createManyMock.mockReset();
    findUniqueMock.mockReset();
  });

  it("stores and returns the first result for a key", async () => {
    findUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedRecord);
    createManyMock.mockResolvedValue({ count: 1 });

    await expect(
      storeIdempotentResult({
        actorId: storedRecord.actorId,
        scope: storedRecord.scope,
        key: storedRecord.key,
        requestHash: storedRecord.requestHash,
        resourceType: storedRecord.resourceType,
        resourceId: storedRecord.resourceId,
        responseStatus: storedRecord.responseStatus,
        responseBody: storedRecord.responseBody,
        expiresAt: storedRecord.expiresAt,
      }),
    ).resolves.toEqual({
      requestHash: storedRecord.requestHash,
      resourceType: "challenge",
      resourceId: "challenge-01",
      responseStatus: 201,
      responseBody: { id: "challenge-01", status: "PENDING" },
    });
    expect(createManyMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: storedRecord.actorId,
        scope: storedRecord.scope,
        key: storedRecord.key,
      }),
      skipDuplicates: true,
    });
  });

  it("rejects reuse of a key with a different request hash", async () => {
    findUniqueMock.mockResolvedValue(storedRecord);

    const result = storeIdempotentResult({
      actorId: storedRecord.actorId,
      scope: storedRecord.scope,
      key: storedRecord.key,
      requestHash: hashIdempotencyRequest({ opponentId: "team-03" }),
      resourceType: "challenge",
      resourceId: "challenge-02",
      responseStatus: 201,
      responseBody: { id: "challenge-02" },
      expiresAt: new Date("2026-08-12T12:00:00Z"),
    });

    await expect(result).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("returns a stored result when the key and request hash match", async () => {
    findUniqueMock.mockResolvedValue(storedRecord);

    await expect(
      storeIdempotentResult({
        actorId: storedRecord.actorId,
        scope: storedRecord.scope,
        key: storedRecord.key,
        requestHash: storedRecord.requestHash,
        resourceType: "challenge",
        resourceId: "ignored-new-resource",
        responseStatus: 201,
        responseBody: { id: "ignored-new-resource" },
        expiresAt: new Date("2026-08-12T12:00:00Z"),
      }),
    ).resolves.toEqual({
      requestHash: storedRecord.requestHash,
      resourceType: "challenge",
      resourceId: "challenge-01",
      responseStatus: 201,
      responseBody: { id: "challenge-01", status: "PENDING" },
    });
    expect(createManyMock).not.toHaveBeenCalled();
  });
});

describe("readIdempotentResult", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("reads a stored result by the composite idempotency key", async () => {
    findUniqueMock.mockResolvedValue(storedRecord);

    await expect(
      readIdempotentResult(
        storedRecord.actorId,
        storedRecord.scope,
        storedRecord.key,
      ),
    ).resolves.toMatchObject({
      requestHash: storedRecord.requestHash,
      resourceId: "challenge-01",
      responseStatus: 201,
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        actorId_scope_key: {
          actorId: storedRecord.actorId,
          scope: storedRecord.scope,
          key: storedRecord.key,
        },
      },
    });
  });
});
