# Milestone 07 — Captain-Controlled Challenges

**Outcome:** Compatible teams agree to play under snapshotted conditions, and the challenging captain becomes the organizer.

## M07-T01 — Define challenge contracts and model

```text
Implement only M07-T01 with schema and migration tests first.

Modify matchmaking shared contracts and schema.prisma; create migration add_match_challenges.
Add MatchChallenge with challengerTeamId, opponentTeamId, challengerAvailabilityId,
opponentAvailabilityId, organizerUserId, MatchFormat, accepted start/end window, origin/radius
snapshot, responseDeadline, bookingDeadline nullable until acceptance, ChallengeStatus, message,
respondedAt, cancelledAt, createdAt, and updatedAt.

Enforce different teams and one active PENDING challenge per ordered availability pair. Snapshot
conditions so later availability edits cannot change an agreement. Define create, response,
summary, and detail Zod schemas.

Commit as:
feat(matchmaking): add challenge persistence
```

## M07-T02 — Implement challenge creation

```text
Implement only M07-T02 with service unit and integration tests first.

Implement createChallenge(actorId, input, now). Require actor to captain the challenger, both
availability rows OPEN and eligible under the exact recommendation rules, and opponent to have an
active captain. Compute responseDeadline using the locked rule. Use an idempotency key scoped to
challenge creation. Reject self-challenge, stale recommendation, incompatible conditions, and
duplicate pending challenge with exact 409/422 codes.

Store both availability IDs and the canonical overlap snapshot. Do not modify availability state
on send. Tests prove retry returns the same challenge.

Commit as:
feat(matchmaking): create idempotent challenges
```

## M07-T03 — Implement accept, decline, cancel, and expiry

```text
Implement only M07-T03 with a table-driven transition test first.

Public service methods:
acceptChallenge(actorId, challengeId, now, tx?)
declineChallenge(actorId, challengeId, now, tx?)
cancelChallenge(actorId, challengeId, now, tx?)
expireDueChallenges(now, tx?)

Only the opponent captain accepts/declines; only the organizer cancels PENDING/ACCEPTED before a
confirmed booking. Acceptance atomically sets both availability rows MATCHED, stores respondedAt,
and computes bookingDeadline. If either availability was matched by another accepted challenge,
return 409 and leave all rows unchanged. Decline/cancel/expire do not change unrelated rows.
Repeat commands return current state without duplicate side effects.

After one challenge is accepted, set every other PENDING challenge referencing either matched
availability row to EXPIRED in the same transaction so no stale actionable challenge remains.

Commit as:
feat(matchmaking): enforce challenge transitions
```

## M07-T04 — Expose challenge API and typed client

```text
Implement only M07-T04 with integration tests first.

Routes:
- POST /api/v1/matchmaking/challenges
- GET /api/v1/matchmaking/challenges/inbox
- GET /api/v1/matchmaking/challenges/outbox
- GET /api/v1/matchmaking/challenges/:id
- POST /:id/accept, /:id/decline, and /:id/cancel

Mutation requests require Idempotency-Key where the service accepts it. Responses include team
public summaries, snapshotted conditions, deadlines, organizer, and available actions computed
for the viewer. Add exact ApiClient methods. Keep static inbox/outbox routes before /:id.

Tests cover both captains, members, unrelated users, expired access, response shapes, pagination,
and idempotent retries.

Commit as:
feat(matchmaking): expose challenge lifecycle
```

## M07-T05 — Build mobile challenge flows

```text
Implement only M07-T05.

Add Challenge action to recommended opponents and create mobile inbox, outbox, detail, and send-
confirmation views. The confirmation must show both teams, format, overlap, area/radius, response
deadline, message, and organizer responsibility. Opponent captains can accept/decline; organizer
can cancel. Members see read-only state. After acceptance, show `Choose a pitch` only to the
organizer, but leave it disabled with Milestone 08 copy until booking exists.

Use generated idempotency keys per user intent and retain a key across network retries. Invalidate
availability/recommendation/challenge queries after transition. Run mobile typecheck and manually
test double taps, stale acceptance, expiry, and offline retry.

Commit as:
feat(mobile): add captain challenge flows
```

## M07-T06 — Add challenge race and deadline tests

```text
Implement only M07-T06.

Add integration tests that concurrently accept two challenges sharing one availability and prove
exactly one succeeds. Test response deadline boundaries, organizer booking deadline calculation,
retry behavior, cancellation permissions, and availability state rollback on failure. Test
expireDueChallenges with a fixed clock; do not use sleeps.

Run matchmaking unit/integration tests, typecheck, lint, and unit suite.

Commit as:
test(matchmaking): cover challenge races
```

## Milestone 07 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
