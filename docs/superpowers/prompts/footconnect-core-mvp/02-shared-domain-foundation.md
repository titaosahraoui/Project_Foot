# Milestone 02 — Shared Domain Foundation

**Outcome:** Later modules share exact money, time, format, error, transaction, and idempotency primitives.

## M02-T01 — Add canonical shared primitives

```text
Implement only M02-T01 with TDD.

Files:
- Create packages/shared/src/domain.ts.
- Create packages/shared/src/domain.test.ts.
- Modify packages/shared/src/index.ts and packages/shared/package.json.
- Modify pnpm-lock.yaml if Vitest must be added to the shared package.

Export Zod schemas and inferred types named MatchFormat, CurrencyCode, Money, UtcDateTime,
GeoPoint, and IdempotencyKey. MatchFormat uses the three canonical enum values. CurrencyCode
accepts only DZD. Money.amountMinor is a safe non-negative integer. UtcDateTime accepts an ISO
8601 string with an explicit timezone and normalizes nothing. IdempotencyKey is 8–128 visible
ASCII characters. Reuse coordinatesSchema rather than creating a competing latitude/longitude
shape.

Tests must reject fractional/negative money, non-DZD currency, timezone-free dates, invalid
coordinates, unsupported formats, and short idempotency keys; they must accept the canonical
examples from 00-master-context.md.

Run the test first and confirm failure because domain.ts does not exist. Then implement and run:
pnpm --filter @footconnect/shared test
pnpm --filter @footconnect/shared typecheck

Commit as:
feat(shared): add core domain primitives
```

## M02-T02 — Standardize API error contracts

```text
Implement only M02-T02 with TDD.

Files:
- Add error response schemas to packages/shared/src/common.ts.
- Create apps/api/src/middleware/error-handler.test.ts.
- Modify apps/api/src/middleware/error-handler.ts.

Define ApiErrorCode with VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT,
STATE_CONFLICT, INVENTORY_CONFLICT, CONDITIONS_VIOLATION, RATE_LIMITED, and INTERNAL_ERROR.
Define ApiErrorResponse as { code, message, issues?, details?, requestId? }. Extend HttpError to
accept a code while preserving current call sites through an explicit default mapping by status.

Tests must assert Zod errors return VALIDATION_ERROR and issues, HttpError(409, ..., code)
preserves its code/details, unexpected errors hide internals, and request IDs are included when
present on the Express request.

Run:
pnpm --filter @footconnect/api test -- src/middleware/error-handler.test.ts
pnpm --filter @footconnect/api typecheck

Commit as:
feat(api): standardize error responses
```

## M02-T03 — Add a shared transaction context

```text
Implement only M02-T03 with TDD.

Files:
- Create apps/api/src/lib/transaction.ts.
- Create apps/api/src/lib/transaction.test.ts.

Export TransactionContext as Prisma.TransactionClient, RepositoryContext as PrismaClient |
TransactionContext, and withTransaction<T>(work: (tx: TransactionContext) => Promise<T>).
withTransaction must call prisma.$transaction once, return the callback result, and propagate
errors so Prisma rolls back. Repositories added later receive an optional RepositoryContext and
default to the shared prisma client; services may pass a TransactionContext only through public
service interfaces.

Mock Prisma in the unit test. Assert result propagation, one transaction invocation, and error
propagation. Do not refactor existing repositories in this task.

Run:
pnpm --filter @footconnect/api test -- src/lib/transaction.test.ts
pnpm --filter @footconnect/api typecheck

Commit as:
feat(api): add cross-module transaction context
```

## M02-T04 — Add durable idempotency records

```text
Implement only M02-T04 with TDD.

Files:
- Modify apps/api/prisma/schema.prisma.
- Create one Prisma migration named add_idempotency_records.
- Create apps/api/src/lib/idempotency.ts and idempotency.test.ts.

Add IdempotencyRecord with UUID id, actorId, scope, key, requestHash, resourceType,
resourceId, responseStatus, responseBody Json, createdAt, and expiresAt. Enforce a unique
constraint on actorId + scope + key and an index on expiresAt.

Export hashIdempotencyRequest(value), readIdempotentResult(actorId, scope, key), and
storeIdempotentResult(input, tx?). Canonicalize JSON object keys before SHA-256 hashing.
Reusing a key with a different request hash throws HttpError 409 with code CONFLICT. Reusing
the same key returns the stored status/body/resource and performs no command work.

Unit tests cover stable hash ordering and mismatch detection. Integration tests use the real
database to prove the unique constraint rejects concurrent duplicate inserts.

Run:
pnpm --filter @footconnect/api prisma:migrate
pnpm --filter @footconnect/api test -- src/lib/idempotency.test.ts
pnpm --filter @footconnect/api test:integration

Commit as:
feat(api): add durable idempotency foundation
```

## Milestone 02 gate

```powershell
pnpm --filter @footconnect/shared test
pnpm --filter @footconnect/api test:integration
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
