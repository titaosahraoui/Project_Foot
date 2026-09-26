# Milestone 14 — Algiers Pilot Verification

**Outcome:** Reproducible Algiers data, complete core-loop evidence, operational visibility, accessible recovery states, and a launch/rollback runbook.

## M14-T01 — Create deterministic Algiers pilot seed data

```text
Implement only M14-T01 with idempotency verification.

Create apps/api/prisma/seed.ts and add the Prisma seed command. Seed deterministic, visibly fake
pilot data: at least 12 teams across Algiers districts, 8 players per 7v7 team, 5 pitch owners,
8 pitches with DZD prices and recurring evening/weekend availability, ratings from 850–1450,
reliability examples NEW/RELIABLE/AT_RISK, open availability, one pending challenge, one accepted
challenge, one pending booking, one scheduled match, and resolved history examples.

Use fixed UUIDs/emails under example.test, documented development password, realistic Algiers
coordinates, Africa/Algiers conversion, and no real personal data. Upsert so running twice produces
the same counts and IDs. Do not run seed automatically in production.

Verify two consecutive seed runs and record counts.

Commit as:
chore(dev): add deterministic Algiers pilot seed
```

## M14-T02 — Add the complete core-loop API test

```text
Implement only M14-T02 with one serial integration file.

Create apps/api/src/core-mvp.e2e.integration.test.ts. Through HTTP endpoints, perform:
register users/assign fixture roles → create two teams/rosters/lineups → create owner pitch/rules →
publish overlapping availability → obtain recommendation → challenge → accept → query exact pitch
inventory → create booking → owner confirm → retrieve match → submit match lineups → owner reports
both teams COMPLETED → captains accept outcomes → both captains and owner submit the same score →
verify UNANIMOUS → assert Elo/history/leaderboard/reliability/notifications.

Use integration helpers, fixed logical clock injection where services support it, exact assertions,
and ID-scoped cleanup. Never use sleeps. Assert no private coordinates, passwords, tokens, or hidden
pre-submission scores leak.

Commit as:
test(e2e): verify complete competitive loop
```

## M14-T03 — Prove concurrency, idempotency, and authorization

```text
Implement only M14-T03.

Create a core MVP risk-matrix integration suite covering simultaneous challenge acceptance,
overlapping booking requests, duplicate owner confirmation, duplicate outcome finalization,
duplicate score submissions, concurrent result deadline/admin resolution, and concurrent Elo replay.
For challenge/availability/team mutations test anonymous, unrelated player, member, wrong captain,
and correct captain. For booking/outcome/owner-score mutations test anonymous, PLAYER, unrelated
PITCH_OWNER, owning PITCH_OWNER, and ADMIN. For admin resolution test anonymous, PLAYER,
PITCH_OWNER, and ADMIN.

Assert one durable side effect, exact 401/403/409/422 code, no partial transaction, and no cross-
tenant response data. Keep concurrency bounded and deterministic with Promise.all and database locks,
not timing sleeps.

Commit as:
test(e2e): cover core lifecycle risks
```

## M14-T04 — Complete observability and worker health

```text
Implement only M14-T04 with unit/integration tests first.

Add structured transition logs containing requestId, actorId, teamId, pitchId, bookingId, matchId,
transition, previousState, nextState, idempotencyKey hash, and duration where available. Never log
tokens, passwords, exact private coordinates, or full dispute notes. Add counters/timers for challenge
conversion, booking conflict/confirmation, no-show, result verification method, disputes, worker
failures, and rating application failures.

Extend health response to report API, PostgreSQL, Redis, and lifecycle worker heartbeat separately.
Write worker heartbeat to Redis with TTL; a missing worker degrades health without marking database
down. Document metric names and alert thresholds in docs/operations/observability.md.

Commit as:
feat(observability): instrument core lifecycle
```

## M14-T05 — Audit accessibility and recovery states

```text
Implement only M14-T05.

Review every new mobile and web screen against repository UI conventions and accessibility basics:
semantic labels/headings, 44px touch targets, keyboard navigation on web, visible focus, contrast,
large text, screen-reader labels, non-color status cues, loading, empty, offline/API error, stale
state, forbidden, and destructive confirmation. Fix only core-MVP screens.

Use the web-design-guidelines skill during execution. Run web lint/typecheck/build and mobile
typecheck. Use the in-app browser to test web at desktop and narrow widths; record evidence in
docs/qa/core-mvp-accessibility.md with exact routes and remaining non-blocking limitations.

Commit as:
fix(ui): close core MVP accessibility gaps
```

## M14-T06 — Write and execute the Algiers pilot runbook

```text
Implement only M14-T06.

Create docs/operations/algiers-pilot-runbook.md containing prerequisites, environment variables,
database/Redis startup, migrations, worker/API/web/mobile startup, seed command, health verification,
test commands, smoke journey, admin dispute handling, data backup, migration rollback strategy,
feature-disable switches, incident contacts as repository roles rather than personal names, launch
criteria, and rollback triggers.

Execute and record evidence for:
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck

Run the manual seeded core loop once. Compare every acceptance criterion in the approved design to
automated or manual evidence. Do not mark an unmet criterion complete; list it as a launch blocker.

Commit as:
docs: add Algiers pilot runbook and evidence
```

## Final pilot acceptance gate

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
git diff --check
```

The pilot is ready only when the full HTTP core-loop test passes, all design acceptance criteria
have evidence, no blocking accessibility/security/concurrency finding remains, and API plus worker
health are both operational.
