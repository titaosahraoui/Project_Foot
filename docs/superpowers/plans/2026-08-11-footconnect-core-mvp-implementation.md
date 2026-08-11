# FootConnect Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete Algiers core loop from the repository's current state through owner-protected reliability, three-party result verification, and idempotent team Elo.

**Architecture:** Extend the existing Express modular monolith with focused matchmaking, booking, match, rating, notification, and admin modules. PostgreSQL owns state; shared Zod schemas define contracts; Expo and Next.js consume the typed REST client. Each milestone is independently reviewable and is decomposed into copy-ready prompts under `docs/superpowers/prompts/footconnect-core-mvp/`.

**Tech Stack:** pnpm 11, Turborepo, Node 22+, Express 4, TypeScript, Prisma 6, PostgreSQL, Redis/BullMQ, Zod, Vitest/Supertest, Expo, React Native, Next.js 16, TanStack Query.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-11-footconnect-core-mvp-design.md` and `docs/superpowers/prompts/footconnect-core-mvp/00-master-context.md`.
- Pilot only in Algiers; render `Africa/Algiers`, store UTC, and use DZD integer minor units.
- Preserve the service-only cross-module boundary.
- Use TDD, focused commits, idempotent lifecycle commands, and database-backed concurrency protection.
- Do not implement any explicitly deferred feature.
- Preserve unrelated working-tree changes.

## Planned file responsibilities

- `packages/shared/src/{domain,matchmaking,booking,match,rating,notification}.ts`: canonical contracts.
- `apps/api/prisma/schema.prisma` and milestone migrations: durable models and constraints.
- `apps/api/src/lib/{transaction,idempotency,queue}.ts`: cross-cutting transaction, retry, and job primitives.
- `apps/api/src/modules/{matchmaking,bookings,matches,ratings,notifications,admin}/`: new or completed bounded contexts.
- Existing `auth`, `users`, `teams`, and `pitches` modules: hardened within their owning milestone.
- `packages/api-client/src/index.ts`: typed methods added with each public endpoint.
- `apps/mobile/src/`: captain/player flows and competitive home experience.
- `apps/web/src/app/`: owner and narrow admin operational surfaces.

---

### Task 1: Baseline and architecture alignment

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/01-baseline-alignment.md`

**Produces:** truthful repository status, aligned Expo toolchain, stable test fixtures, and verified baseline checks.

- [ ] Execute M01-T01 through M01-T04 in order.
- [ ] Pass the M01 milestone gate.

### Task 2: Shared domain foundation

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/02-shared-domain-foundation.md`

**Consumes:** Task 1 baseline.

**Produces:** canonical primitives, error/idempotency contracts, transaction context, and API integration-test helpers.

- [ ] Execute M02-T01 through M02-T04 in order.
- [ ] Pass the M02 milestone gate.

### Task 3: Authentication and profiles

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/03-auth-profiles.md`

**Consumes:** Transaction and error primitives.

**Produces:** durable rotating sessions, role middleware, validated player profiles, and completed profile clients.

- [ ] Execute M03-T01 through M03-T05 in order.
- [ ] Pass the M03 milestone gate.

### Task 4: Teams and competitive identity

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/04-teams-identity.md`

**Consumes:** Authenticated users and role enforcement.

**Produces:** captain transfer, cards, formations, lineups, appearance-ready snapshots, and rating ownership foundation.

- [ ] Execute M04-T01 through M04-T06 in order.
- [ ] Pass the M04 milestone gate.

### Task 5: Pitches and owner operations

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/05-pitches-owner-operations.md`

**Consumes:** Owner roles and shared time/money primitives.

**Produces:** DZD pricing, availability rules, closures, exact inventory queries, owner calendar, and mobile pitch discovery.

- [ ] Execute M05-T01 through M05-T07 in order.
- [ ] Pass the M05 milestone gate.

### Task 6: Team availability and recommendations

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/06-team-availability-recommendations.md`

**Consumes:** Teams, ratings foundation, pitch formats, and geo primitives.

**Produces:** looking-for-match windows and explainable eligible-opponent ranking.

- [ ] Execute M06-T01 through M06-T07 in order.
- [ ] Pass the M06 milestone gate.

### Task 7: Challenges

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/07-challenges.md`

**Consumes:** Two compatible open availability records.

**Produces:** snapshotted accepted conditions, organizer ownership, lifecycle endpoints, and expiry-ready commands.

- [ ] Execute M07-T01 through M07-T06 in order.
- [ ] Pass the M07 milestone gate.

### Task 8: Booking after agreement

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/08-booking-after-agreement.md`

**Consumes:** Accepted challenge and exact pitch inventory.

**Produces:** idempotent booking requests, database conflict guard, owner decisions, and atomic match creation.

- [ ] Execute M08-T01 through M08-T08 in order.
- [ ] Pass the M08 milestone gate.

### Task 9: Match preparation

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/09-match-preparation.md`

**Consumes:** Confirmed booking and team lineups.

**Produces:** upcoming-match APIs, designated captains, immutable lineup snapshots, and fixture experiences.

- [ ] Execute M09-T01 through M09-T05 in order.
- [ ] Pass the M09 milestone gate.

### Task 10: Booking outcomes and reputation

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/10-reputation.md`

**Consumes:** Scheduled/finished bookings and participating teams.

**Produces:** per-team outcome reports, disputes, admin resolution, and transparent reliability projections.

- [ ] Execute M10-T01 through M10-T07 in order.
- [ ] Pass the M10 milestone gate.

### Task 11: Three-party result consensus

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/11-result-consensus.md`

**Consumes:** Match participants, designated captains, owner, and compatible booking outcomes.

**Produces:** hidden submissions, consensus, provisional majority, disputes, and audited resolution.

- [ ] Execute M11-T01 through M11-T07 in order.
- [ ] Pass the M11 milestone gate.

### Task 12: Elo, history, and leaderboards

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/12-elo-leaderboards.md`

**Consumes:** One verified result.

**Produces:** atomic two-team Elo, immutable history, records, leaderboard APIs, and competitive team/home UI.

- [ ] Execute M12-T01 through M12-T06 in order.
- [ ] Pass the M12 milestone gate.

### Task 13: Notifications and integrated experiences

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/13-notifications-integration.md`

**Consumes:** Lifecycle commands from Tasks 7–12.

**Produces:** durable notifications, BullMQ deadlines/reminders, action queues, and cohesive mobile/web journeys.

- [ ] Execute M13-T01 through M13-T07 in order.
- [ ] Pass the M13 milestone gate.

### Task 14: Algiers pilot verification

**Prompt file:** `docs/superpowers/prompts/footconnect-core-mvp/14-algiers-pilot.md`

**Consumes:** Complete core MVP.

**Produces:** deterministic Algiers seed data, full-loop E2E coverage, concurrency/security evidence, observability, accessibility review, and launch runbook.

- [ ] Execute M14-T01 through M14-T06 in order.
- [ ] Pass the final pilot acceptance gate.

## Execution handoff

Use one of these modes after reviewing the prompt pack:

1. **Subagent-driven:** dispatch one fresh implementer per micro-task and review after each task.
2. **Inline:** execute one milestone at a time with a checkpoint after its gate.

Never execute multiple prompts that modify `schema.prisma`, the same module, or the same client navigation in parallel.
