# FootConnect Baseline Audit - 2026-08-11

## Purpose

This audit records the implementation baseline before the redesigned core MVP is built. It compares the current repository with the [approved core MVP design](superpowers/specs/2026-08-11-footconnect-core-mvp-design.md) and assigns every current module and client surface to the milestone that should extend, replace, or deliberately defer it.

No runtime behavior was changed while producing this audit.

## Classification

| Classification | Meaning |
| --- | --- |
| Implemented | The current advertised slice has working code and useful automated coverage. Later work may still extend it. |
| Partial | Real behavior exists, but it does not yet satisfy the approved core MVP design. |
| Stub | A route or screen exists only as a placeholder and does not implement its domain behavior. |
| Absent | The approved design requires the surface, but no corresponding module or product flow exists. |

## Executive baseline

- `auth`, `users`, `teams`, and `pitches` have real implementations, but all four are incomplete against the approved design.
- `bookings`, `matches`, `social`, and `notifications` are route stubs that return `501` through the shared stub router.
- `matchmaking`, `ratings`, and `admin` API modules are absent.
- Competitive rating and record fields still live on `Team`, although the approved design assigns them to the future `ratings` module.
- The mobile package uses Expo 54 while the mobile repository instructions require Expo 56.
- The default baseline commands `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- The audit leaves unrelated working-tree content and all runtime code untouched.

## API module inventory

The API mounts its current routers in [`apps/api/src/app.ts`](../apps/api/src/app.ts). Implemented modules generally follow the route -> controller -> service -> repository shape documented in [`apps/api/src/modules/README.md`](../apps/api/src/modules/README.md).

| Module | Status | Current evidence and gap | Next owning milestone |
| --- | --- | --- | --- |
| `health` | Implemented | The route, controller, service, and unit test are present in [`apps/api/src/modules/health`](../apps/api/src/modules/health). It checks PostgreSQL and Redis, but the approved design also requires worker health and richer observability. | M14 - full-loop verification and pilot readiness |
| `auth` | Partial | [`auth.routes.ts`](../apps/api/src/modules/auth/auth.routes.ts), [`auth.service.ts`](../apps/api/src/modules/auth/auth.service.ts), and [`auth.repository.ts`](../apps/api/src/modules/auth/auth.repository.ts) implement registration, login, refresh, and logout. The slice lacks the redesigned durable session lifecycle, hardened authorization primitives, and required rate limiting. | M03 - authentication and player profiles |
| `users` | Partial | [`users.routes.ts`](../apps/api/src/modules/users/users.routes.ts), [`users.service.ts`](../apps/api/src/modules/users/users.service.ts), and [`users.repository.ts`](../apps/api/src/modules/users/users.repository.ts) implement authenticated profile read/update behavior. Profile contracts and role enforcement still need to be aligned with player-card and MVP authorization requirements. | M03 - authentication and player profiles |
| `teams` | Partial | [`teams.routes.ts`](../apps/api/src/modules/teams/teams.routes.ts), [`teams.service.ts`](../apps/api/src/modules/teams/teams.service.ts), and [`teams.integration.test.ts`](../apps/api/src/modules/teams/teams.integration.test.ts) cover team CRUD, invitations, membership removal, and leaving. Active captain transfer, player cards, formations, lineups, lifecycle rules, and ratings separation are missing. | M04 - teams, cards, formations, lineups, captain transfer |
| `pitches` | Partial | [`pitches.routes.ts`](../apps/api/src/modules/pitches/pitches.routes.ts), [`pitches.service.ts`](../apps/api/src/modules/pitches/pitches.service.ts), and [`pitches.integration.test.ts`](../apps/api/src/modules/pitches/pitches.integration.test.ts) implement owner CRUD, search, and recurring slots. Exact inventory calculation, closures, DZD minor-unit money, ownership middleware, and database-backed overlap protection are missing. | M05 - pitches and exact inventory; M08 - booking collision protection |
| `bookings` | Stub | [`bookings.routes.ts`](../apps/api/src/modules/bookings/bookings.routes.ts) delegates to [`_stub.ts`](../apps/api/src/modules/_stub.ts) and returns `501`; there is no controller, service, repository, schema, or persistence model. | M08 - organizer booking; M10 - outcomes and reliability |
| `matches` | Stub | [`matches.routes.ts`](../apps/api/src/modules/matches/matches.routes.ts) delegates to the shared `501` stub; scheduling, snapshots, result submissions, and consensus do not exist. | M09 - scheduled matches; M11 - verified results |
| `social` | Stub | [`social.routes.ts`](../apps/api/src/modules/social/social.routes.ts) delegates to the shared `501` stub. The social feed is an explicit core MVP non-goal. | Post-MVP - intentionally deferred |
| `notifications` | Stub | [`notifications.routes.ts`](../apps/api/src/modules/notifications/notifications.routes.ts) delegates to the shared `501` stub; no event inbox, push delivery, deadline jobs, or retry handling exists. | M13 - integrated product and notification experiences |
| `matchmaking` | Absent | There is no `apps/api/src/modules/matchmaking` directory. Team availability, recommendations, eligibility, ranking, and challenges are therefore absent. | M06 - availability and recommendations; M07 - challenges |
| `ratings` | Absent | There is no `apps/api/src/modules/ratings` directory. Current Elo and record fields remain on `Team`, and there is no rating history or leaderboard service. | M12 - Elo, rating history, records, leaderboards |
| `admin` | Absent | There is no `apps/api/src/modules/admin` directory or audited resolution API. | M10 - booking disputes; M11 - result disputes; M13 - admin UI integration |

### API documentation drift

[`apps/api/src/modules/README.md`](../apps/api/src/modules/README.md) still labels `auth`, `users`, `teams`, and `pitches` as stubs even though those modules now contain working implementations. Architecture documentation alignment belongs to M01-T02; this audit records the mismatch without editing that file.

## Persistence inventory

The current Prisma schema is [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma), backed by three committed migrations in [`apps/api/prisma/migrations`](../apps/api/prisma/migrations).

| Surface | Status | Current evidence and gap | Next owning milestone |
| --- | --- | --- | --- |
| Users and authentication identity | Partial | `User` stores identity, password hash, role, profile fields, and refresh-token version. Durable refresh sessions, audit records, and broader authorization state are absent. | M02 - foundations; M03 - auth hardening |
| Teams and memberships | Partial | `Team`, `TeamMembership`, and `Invitation` exist. `Team` still stores `skillRating`, `wins`, and `losses`; it has no draw count or ratings-owned history. Captain transfer, player-card, formation, and lineup models are absent. | M02 - schema ownership; M04 - team domain; M12 - ratings migration |
| Pitches and recurring slots | Partial | `Pitch` and `PitchSlot` exist. Price is stored as `Float`, recurring availability is stored as strings, and there are no pitch-block or exact-inventory models. | M02 - shared money/time conventions; M05 - pitch inventory |
| Matchmaking data | Absent | No `TeamAvailability` or `MatchChallenge` model exists. | M06 and M07 |
| Booking and reliability data | Absent | No booking, booking outcome, team outcome, or `TeamReliability` model exists. | M08 and M10 |
| Match and result data | Absent | No scheduled match, lineup snapshot, score submission, verified result, or result-dispute model exists. | M09 and M11 |
| Ratings data | Absent | No `TeamRating` or `RatingHistory` model exists. | M12 |
| Cross-cutting durability | Absent | No idempotency record, domain audit record, outbox/job record, or shared transaction abstraction is represented in the schema. | M02; job execution completed in M13 |

## Shared and platform packages

| Surface | Status | Current evidence and gap | Next owning milestone |
| --- | --- | --- | --- |
| `@footconnect/shared` | Partial | [`packages/shared/src/index.ts`](../packages/shared/src/index.ts) exports common, health, user, auth, team, and pitch contracts only. Redesigned lifecycle enums, money/time primitives, and contracts for matchmaking through ratings are absent. | M02, then each domain milestone M03-M13 |
| `@footconnect/api-client` | Partial | [`packages/api-client/src/index.ts`](../packages/api-client/src/index.ts) exposes health, auth, teams, and pitches. It has no bookings, matches, results, ratings, reputation, notifications, or admin operations. | Extended with each API milestone M03-M13 |
| `@footconnect/ui` | Implemented foundation | [`packages/ui/src/tokens.ts`](../packages/ui/src/tokens.ts) provides shared design tokens. Domain flows remain owned by the clients rather than this package. | M13 - integration polish as needed |
| `@footconnect/config` | Implemented foundation | [`packages/config/tsconfig.base.json`](../packages/config/tsconfig.base.json) and [`packages/config/prettier.config.mjs`](../packages/config/prettier.config.mjs) provide shared TypeScript and formatting configuration. | Maintain through all milestones |
| PostgreSQL and Redis development infrastructure | Implemented foundation | [`infra/docker-compose.yml`](../infra/docker-compose.yml) provisions PostgreSQL 16 and Redis 7. No BullMQ worker application or worker health surface exists. | M13 - deadlines, reminders, delivery, retries |
| CI | Implemented foundation | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) installs, typechecks, lints, tests, and builds on pull requests and `main`. Full-loop database and end-to-end gates are not present. | M14 - verified core loop and release gate |

## Mobile client inventory

The mobile navigator is defined in [`apps/mobile/src/navigation.ts`](../apps/mobile/src/navigation.ts). Its current authenticated tabs are Home, Squad, Play, and Profile; the approved design requires Home, Teams, Play, Notifications, and Profile.

| Screen or surface | Status | Current evidence and gap | Next owning milestone |
| --- | --- | --- | --- |
| Login | Partial | [`LoginScreen.tsx`](../apps/mobile/src/screens/LoginScreen.tsx) is wired to the auth context. Session hardening and recoverable error behavior depend on the redesigned auth contracts. | M03 |
| Registration | Partial | [`RegisterScreen.tsx`](../apps/mobile/src/screens/RegisterScreen.tsx) creates users through the current auth client. It needs final profile and validation alignment. | M03 |
| Profile | Partial | [`ProfileScreen.tsx`](../apps/mobile/src/screens/ProfileScreen.tsx) reads and edits the current user profile. Player-card identity and final role-aware behavior are absent. | M03 and M04 |
| Team list | Partial | [`TeamsListScreen.tsx`](../apps/mobile/src/screens/TeamsListScreen.tsx) loads memberships and navigates to team flows. Redesigned active-team, Elo, reliability, and lifecycle states are absent. | M04; competitive data added in M10 and M12 |
| Team creation | Partial | [`CreateTeamScreen.tsx`](../apps/mobile/src/screens/CreateTeamScreen.tsx) submits the current team contract. Preferred formats, captain lifecycle, formation, and lineup setup are incomplete. | M04 |
| Team detail | Partial | [`TeamDetailScreen.tsx`](../apps/mobile/src/screens/TeamDetailScreen.tsx) displays the current team and membership controls. Player cards, formation, lineup, rating history, and reliability are absent. | M04, M10, and M12 |
| Invitations | Partial | [`InvitationsScreen.tsx`](../apps/mobile/src/screens/InvitationsScreen.tsx) supports current team invitations. Final authorization and transition behavior depend on M04 hardening. | M04 |
| Home | Partial | [`HomeScreen.tsx`](../apps/mobile/src/screens/HomeScreen.tsx) is a visual scaffold and explicitly has no fixtures. It lacks next match, pending actions, recommendations, leaderboard position, Elo, and reliability data. | M06-M13, integrated in M13 |
| Play | Partial | [`PlayScreen.tsx`](../apps/mobile/src/screens/PlayScreen.tsx) implements pitch discovery and recurring-slot viewing, while ranked challenges are a placeholder. Availability, recommendations, challenges, booking, match, and result flows are absent. | M05-M12, integrated in M13 |
| Notifications tab and inbox | Absent | No notification screen or tab exists in the navigator or screen directory. | M13 |
| Competitive action flows | Absent | There are no screens for team availability, opponent recommendations, challenges, accepted-challenge pitch selection, bookings, scheduled matches, booking outcomes, score consensus, disputes, Elo history, or leaderboard. | M06-M13 |
| Social feed | Absent | No social screen exists. This matches the approved core MVP non-goal. | Post-MVP - intentionally deferred |

### Mobile toolchain inconsistency

[`apps/mobile/package.json`](../apps/mobile/package.json) pins `expo` to `~54.0.36`, while [`apps/mobile/AGENTS.md`](../apps/mobile/AGENTS.md) requires development against Expo 56 documentation. This must be resolved deliberately before feature work relies on version-specific Expo behavior. Ownership: M01-T02 for documented target alignment, then the first approved dependency-upgrade task before mobile runtime changes.

## Pitch-owner web inventory

The web application currently contains only authentication and pitch-management routes under [`apps/web/src/app`](../apps/web/src/app).

| Route or surface | Status | Current evidence and gap | Next owning milestone |
| --- | --- | --- | --- |
| `/login` | Partial | [`login/page.tsx`](../apps/web/src/app/login/page.tsx) uses the current auth context. Final session and role hardening depend on M03. | M03 |
| `/` owner home | Partial | [`page.tsx`](../apps/web/src/app/page.tsx) provides the current owner landing/dashboard experience, but it lacks today's schedule, pending actions, and operating metrics. | M05 and M13 |
| `/pitches` | Partial | [`pitches/page.tsx`](../apps/web/src/app/pitches/page.tsx) lists owner pitches. Exact inventory, DZD presentation, closures, and calendar state are incomplete. | M05 |
| `/pitches/new` | Partial | [`pitches/new/page.tsx`](../apps/web/src/app/pitches/new/page.tsx) creates pitches with current pricing and recurring-slot contracts. It needs DZD minor units and hardened availability rules. | M05 |
| `/pitches/[id]` | Partial | [`pitches/[id]/page.tsx`](../apps/web/src/app/pitches/%5Bid%5D/page.tsx) edits pitch details and recurring slots. Closures, exact inventory, ownership hardening, and calendar conflicts are absent. | M05 |
| Booking actions and schedule | Absent | There is no route for booking confirmation/decline, exact schedule management, or owner cancellation. | M08 and M13 |
| Booking outcomes and reliability disputes | Absent | There is no outcome-entry or dispute-status route. | M10 and M13 |
| Independent score submission | Absent | There is no owner match-score action. | M11 and M13 |
| Admin resolution queues | Absent | There is no admin route for booking-outcome or match-result disputes. | M10, M11, and M13 |

The current pitch screens render dollar-denominated prices even though the approved pilot requires DZD. Currency and minor-unit correction belongs to M02 contracts and M05 pitch integration.

## Automated coverage baseline

| Area | Current evidence | Assessment |
| --- | --- | --- |
| Unit tests | [`health.service.test.ts`](../apps/api/src/modules/health/health.service.test.ts), [`jwt.test.ts`](../apps/api/src/lib/jwt.test.ts), and [`password.test.ts`](../apps/api/src/lib/password.test.ts) are included in the default test run. | Useful foundation; no redesigned lifecycle, recommendation, consensus, reliability, or Elo unit tests exist. |
| Integration suites | [`auth.integration.test.ts`](../apps/api/src/modules/auth/auth.integration.test.ts), [`teams.integration.test.ts`](../apps/api/src/modules/teams/teams.integration.test.ts), and [`pitches.integration.test.ts`](../apps/api/src/modules/pitches/pitches.integration.test.ts) exist. | Useful existing slices, but they are separate from the default 10-test baseline and do not cover future modules or cross-module atomicity. |
| Client tests | No mobile or web test files are present under their source directories. | Absent; domain and end-to-end coverage must be added with the owning milestones and finalized in M14. |
| End-to-end core loop | No automated create-team-through-verified-Elo flow exists. | Absent; M14 owns final full-loop verification. |

## Baseline verification

Commands were run from a clean isolated worktree after `pnpm install`.

| Command | Result on 2026-08-11 |
| --- | --- |
| `pnpm typecheck` | Pass: 9 Turbo tasks successful across all 7 workspaces. |
| `pnpm lint` | Pass: ESLint completed with exit code 0. |
| `pnpm test` | Pass: 3 test files and 10 tests passed. |

## Milestone ownership summary

| Milestone | Baseline responsibility |
| --- | --- |
| M01 | Align architecture/status documentation and resolve documented platform targets without changing product scope. |
| M02 | Establish shared lifecycle states, money/time primitives, persistence ownership, transaction/idempotency/audit foundations. |
| M03 | Harden auth, authorization, sessions, profiles, and their existing client flows. |
| M04 | Complete team identity, captaincy, player cards, formations, and lineups; remove ratings ownership from `Team`. |
| M05 | Complete pitch ownership, DZD pricing, recurring rules, closures, exact inventory, and owner calendar. |
| M06 | Add team availability and explainable opponent recommendations. |
| M07 | Add captain-controlled challenge lifecycle. |
| M08 | Add accepted-challenge booking and conflict-safe owner confirmation. |
| M09 | Add scheduled matches, captain/participant snapshots, and pre-match lineups. |
| M10 | Add booking outcomes, disputes, and objective team reliability. |
| M11 | Add hidden three-party score submission, consensus, and audited result resolution. |
| M12 | Add atomic, idempotent Elo; competitive records; rating history; and leaderboards. |
| M13 | Integrate all player, owner, admin, notification, deadline, and recovery experiences. |
| M14 | Prove the full Algiers core loop, concurrency and retry safety, observability, and pilot readiness. |

## Audit conclusion

The repository is not a Phase 0 scaffold. It already has usable foundations for authentication, profiles, teams, pitches, mobile team management, mobile pitch discovery, and the owner pitch dashboard. The redesigned implementation should harden and migrate those slices in place. The competitive loop after pitch discovery - availability, recommendations, challenges, booking, scheduled matches, reliability, verified results, Elo, and notifications - remains the main body of new work.
