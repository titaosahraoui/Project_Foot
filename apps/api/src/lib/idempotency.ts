import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/error-handler";
import { prisma } from "./prisma";
import type { RepositoryContext } from "./transaction";

export interface IdempotentResult {
  requestHash: string;
  resourceType: string;
  resourceId: string;
  responseStatus: number;
  responseBody: Prisma.JsonValue;
}

export interface StoreIdempotentResultInput {
  actorId: string;
  scope: string;
  key: string;
  requestHash: string;
  resourceType: string;
  resourceId: string;
  responseStatus: number;
  responseBody: Prisma.InputJsonValue;
  expiresAt: Date;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }

  return value;
}

export function hashIdempotencyRequest(value: unknown): string {
  const canonicalJson = JSON.stringify(sortJson(value));
  if (canonicalJson === undefined) {
    throw new TypeError("Idempotency request must be JSON serializable");
  }

  return createHash("sha256").update(canonicalJson).digest("hex");
}

function toResult(record: {
  requestHash: string;
  resourceType: string;
  resourceId: string;
  responseStatus: number;
  responseBody: Prisma.JsonValue;
}): IdempotentResult {
  return {
    requestHash: record.requestHash,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    responseStatus: record.responseStatus,
    responseBody: record.responseBody,
  };
}

function assertMatchingRequest(
  result: IdempotentResult,
  requestHash: string,
  scope: string,
  key: string,
): IdempotentResult {
  if (result.requestHash !== requestHash) {
    throw new HttpError(
      409,
      "Idempotency key was already used for a different request",
      "CONFLICT",
      { scope, key },
    );
  }

  return result;
}

async function findRecord(
  actorId: string,
  scope: string,
  key: string,
  context: RepositoryContext,
): Promise<IdempotentResult | null> {
  const record = await context.idempotencyRecord.findUnique({
    where: { actorId_scope_key: { actorId, scope, key } },
  });
  return record ? toResult(record) : null;
}

export function readIdempotentResult(
  actorId: string,
  scope: string,
  key: string,
): Promise<IdempotentResult | null> {
  return findRecord(actorId, scope, key, prisma);
}

export async function storeIdempotentResult(
  input: StoreIdempotentResultInput,
  context: RepositoryContext = prisma,
): Promise<IdempotentResult> {
  const existing = await findRecord(
    input.actorId,
    input.scope,
    input.key,
    context,
  );
  if (existing) {
    return assertMatchingRequest(
      existing,
      input.requestHash,
      input.scope,
      input.key,
    );
  }

  await context.idempotencyRecord.createMany({
    data: input,
    skipDuplicates: true,
  });

  const stored = await findRecord(
    input.actorId,
    input.scope,
    input.key,
    context,
  );
  if (!stored) {
    throw new HttpError(
      409,
      "Idempotency result could not be resolved",
      "CONFLICT",
      { scope: input.scope, key: input.key },
    );
  }

  return assertMatchingRequest(
    stored,
    input.requestHash,
    input.scope,
    input.key,
  );
}
