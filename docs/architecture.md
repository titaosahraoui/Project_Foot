# FootConnect Architecture and Core MVP Roadmap

- **Design status:** Approved
- **Pilot market:** Algiers, Algeria
- **Implementation status:** Existing product slices are being hardened and extended; this is not a greenfield scaffold.

## Product boundary

FootConnect is competitive amateur football infrastructure. The core MVP helps teams repeatedly complete this loop:

> Create a team -> publish availability -> receive suitable opponent recommendations -> send or accept a captain-controlled challenge -> agree to play -> organizer reserves a pitch -> play -> verify the score -> update Elo and reliability -> play again.

Pitch owners complete a connected operational loop:

> List a pitch -> publish availability -> confirm a booking -> host the match -> report each team's booking outcome -> independently submit the score -> build reliable demand.

The first pilot is intentionally limited to Algiers. A general social feed, follows, posts, chat, and online payments are deferred. Payment may happen off-platform during the MVP.

The complete product rules live in the [approved core MVP design](superpowers/specs/2026-08-11-footconnect-core-mvp-design.md). The [implementation plan](superpowers/plans/2026-08-11-footconnect-core-mvp-implementation.md) and [layered prompt pack](superpowers/prompts/footconnect-core-mvp/README.md) turn that design into dependency-ordered work.

## Preserved technical decisions

- Keep a single Express and TypeScript modular monolith until a module has a demonstrated reason to scale independently.
- Keep PostgreSQL and Prisma as the durable source of truth.
- Keep Redis for cache, refresh/session support, and retryable deadline or notification jobs; durable lifecycle state remains in PostgreSQL.
- Keep the player application in React Native with Expo and the pitch-owner dashboard in Next.js.
- Keep REST endpoints and shared Zod schemas as the API contract.
- Keep team Elo as the initial competitive rating. Individual Elo is outside the MVP.
- Use simple, explainable opponent recommendations; captains retain the decision to challenge and accept.

The checked-in mobile baseline is Expo 54 with React 19.1 and React Native 0.81. Dependency upgrades are separate, explicitly approved work and are not required to describe or implement the product architecture.

## Technology stack

| Concern                            | Current choice                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Monorepo                           | Turborepo + pnpm workspaces                                                             |
| Backend                            | Express + TypeScript modular monolith                                                   |
| Database and ORM                   | PostgreSQL + Prisma                                                                     |
| Cache and background-work backbone | Redis; BullMQ is planned for deadline and notification work                             |
| API contract                       | REST + Zod schemas from `@footconnect/shared`                                           |
| Player client                      | React Native + Expo                                                                     |
| Owner and narrow admin client      | Next.js + TypeScript                                                                    |
| Typed client                       | `@footconnect/api-client` shared by mobile and web                                      |
| Client server-state layer          | TanStack Query                                                                          |
| Testing                            | Vitest, Supertest, real PostgreSQL integration suites, and later full-loop E2E coverage |

## Monorepo shape

```text
apps/
  api/       Express modular monolith
  web/       Pitch-owner dashboard and future narrow admin queues
  mobile/    Player and captain application
packages/
  shared/       Canonical Zod schemas and inferred types
  api-client/   Typed REST client
  ui/           Shared design tokens and primitives
  config/       Shared TypeScript, ESLint, and Prettier configuration
infra/
  docker-compose.yml
```

## Modular-monolith boundary

The API is one deployable split into bounded contexts under `apps/api/src/modules/<name>/`. A complete module normally contains routes, controller, service, repository, and schema files.

The service is the module's public surface. A module may call another module's `*.service.ts`; it must never import another module's `*.repository.ts` or access another module's Prisma data directly. Shared multi-module transactions must preserve ownership through service-level orchestration.

Planned bounded contexts are `auth`, `users`, `teams`, `pitches`, `matchmaking`, `bookings`, `matches`, `ratings`, `notifications`, and `admin`. The existing `social` stub is deferred beyond the core MVP.

## Competitive lifecycle

1. A captain publishes a team availability window with format, location, time, and search preferences.
2. The matchmaking module filters ineligible teams and ranks compatible opponents using explainable factors such as time overlap, distance, Elo difference, and reliability.
3. The captain sends a challenge. The other captain accepts, declines, or lets it expire. Acceptance records agreement to play; it does not reserve pitch inventory.
4. The challenging captain becomes the organizer and requests an exact compatible pitch slot.
5. The pitch owner confirms or declines the request. Confirmation atomically protects the slot and creates the scheduled match.
6. After the match, the owner reports a booking outcome for each team. Resolved team-caused outcomes update objective reliability.
7. Both designated captains and the pitch owner independently submit the final home and away score.
8. A verified consensus or audited admin decision produces one result. Elo and competitive records update atomically and exactly once.

PostgreSQL owns every lifecycle transition. Redis-backed jobs may remind or expire work, but each job must re-read current database state and be safe to retry.

## Result verification

Score submissions remain hidden from a party until that party submits or the submission window closes.

- Three identical submissions verify immediately as unanimous.
- Two identical submissions create a provisional majority. The dissenting party receives a dispute window; without a dispute, the majority score verifies.
- If the owner misses the deadline but both captains agree, the captains' score can verify after the deadline rules run.
- Three different scores, fewer than two agreeing scores at deadline, or an explicit dispute require audited admin resolution.

A score can verify only after both team booking outcomes resolve as completed. Original submissions are immutable audit evidence. Elo does not change while a result is awaiting submissions, provisional, or disputed.

## Team reliability

Reliability protects pitch owners with objective booking behavior rather than subjective reviews.

- Completed booking: `1` point
- Late cancellation: `0.25` points
- No-show: `0` points
- Owner cancellation: excluded

The displayed percentage is earned points divided by resolved team-responsible bookings. Teams with fewer than three qualifying bookings display `NEW`, together with their completed, late-cancellation, and no-show counts. Disputed outcomes do not affect reliability until resolved.

Reliability and Elo answer different questions: reliability describes whether a team honors bookings; Elo describes competitive results.

## Factual implementation status

The detailed evidence is in the [2026-08-11 baseline audit](baseline-audit-2026-08-11.md).

| Surface          | Status                 | Core gap and owner                                                                                                     |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `health`         | Implemented foundation | Worker health and pilot observability complete in M14                                                                  |
| `auth`, `users`  | Partial                | Sessions, authorization, and profile hardening in M03                                                                  |
| `teams`          | Partial                | Captain transfer, player cards, formations, and lineups in M04                                                         |
| `pitches`        | Partial                | DZD pricing, exact inventory, closures, owner calendar, and conflicts in M05 and M08                                   |
| `bookings`       | Stub                   | Agreement-first booking lifecycle in M08; outcomes and reliability in M10                                              |
| `matches`        | Stub                   | Match preparation in M09; verified results in M11                                                                      |
| `notifications`  | Stub                   | Durable inbox, reminders, and deadlines in M13                                                                         |
| `social`         | Stub and deferred      | Outside the core MVP                                                                                                   |
| `matchmaking`    | Absent                 | Availability and recommendations in M06; challenges in M07                                                             |
| `ratings`        | Absent                 | Team Elo, records, history, and leaderboards in M12                                                                    |
| `admin`          | Absent                 | Audited outcome and result resolution in M10, M11, and M13                                                             |
| Mobile client    | Partial                | Auth, team, pitch, and scaffolded home/play surfaces exist; competitive lifecycle integration completes across M03-M13 |
| Owner web client | Partial                | Auth and pitch management exist; booking, outcome, score, and admin operations complete across M05-M13                 |

## Delivery roadmap

Every milestone has a focused prompt file in the [prompt-pack index](superpowers/prompts/footconnect-core-mvp/README.md). Work proceeds in order and each milestone must pass its own verification gate.

| Milestone | Outcome                                                                                 | Prompt                                                                                          |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| M01       | Baseline and architecture alignment                                                     | [M01 prompts](superpowers/prompts/footconnect-core-mvp/01-baseline-alignment.md)                |
| M02       | Shared domain, persistence, transaction, idempotency, and audit foundation              | [M02 prompts](superpowers/prompts/footconnect-core-mvp/02-shared-domain-foundation.md)          |
| M03       | Authentication, authorization, sessions, and profiles                                   | [M03 prompts](superpowers/prompts/footconnect-core-mvp/03-auth-profiles.md)                     |
| M04       | Teams, competitive identity, captaincy, formations, and lineups                         | [M04 prompts](superpowers/prompts/footconnect-core-mvp/04-teams-identity.md)                    |
| M05       | Pitches, DZD pricing, exact inventory, closures, and owner operations                   | [M05 prompts](superpowers/prompts/footconnect-core-mvp/05-pitches-owner-operations.md)          |
| M06       | Team availability and explainable opponent recommendations                              | [M06 prompts](superpowers/prompts/footconnect-core-mvp/06-team-availability-recommendations.md) |
| M07       | Captain-controlled challenge lifecycle                                                  | [M07 prompts](superpowers/prompts/footconnect-core-mvp/07-challenges.md)                        |
| M08       | Organizer booking after agreement and conflict-safe owner confirmation                  | [M08 prompts](superpowers/prompts/footconnect-core-mvp/08-booking-after-agreement.md)           |
| M09       | Scheduled matches, participant snapshots, and pre-match preparation                     | [M09 prompts](superpowers/prompts/footconnect-core-mvp/09-match-preparation.md)                 |
| M10       | Booking outcomes, disputes, and transparent team reliability                            | [M10 prompts](superpowers/prompts/footconnect-core-mvp/10-reputation.md)                        |
| M11       | Hidden three-party result submissions, consensus, and audited resolution                | [M11 prompts](superpowers/prompts/footconnect-core-mvp/11-result-consensus.md)                  |
| M12       | Atomic team Elo, records, rating history, and Algiers leaderboards                      | [M12 prompts](superpowers/prompts/footconnect-core-mvp/12-elo-leaderboards.md)                  |
| M13       | Notifications, deadlines, recovery paths, and integrated player/owner/admin experiences | [M13 prompts](superpowers/prompts/footconnect-core-mvp/13-notifications-integration.md)         |
| M14       | Full-loop verification and Algiers pilot readiness                                      | [M14 prompts](superpowers/prompts/footconnect-core-mvp/14-algiers-pilot.md)                     |

## Core MVP acceptance

The Algiers pilot is ready only when automated evidence shows that two eligible teams can discover each other, agree to play, obtain a conflict-free owner-confirmed booking, complete the match, submit three independent scores, resolve consensus or a dispute, and apply one idempotent Elo update. The same evidence must show that owner-reported booking outcomes update team reliability without penalizing a team for an owner cancellation or an opponent's failure.

Full acceptance criteria, lifecycle transition rules, defaults, and test scenarios remain canonical in the [approved design](superpowers/specs/2026-08-11-footconnect-core-mvp-design.md).
