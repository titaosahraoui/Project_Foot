# Master Context — FootConnect Core MVP

Paste or reference this context with every task prompt.

## Required reading

- `AGENTS.md`
- The nearest nested `AGENTS.md` for any application being changed
- `docs/superpowers/specs/2026-08-11-footconnect-core-mvp-design.md`
- The active milestone prompt file
- Existing implementations and tests in the files named by the active prompt

For Next.js work, read the relevant versioned guides under `node_modules/next/dist/docs/` before editing. For Expo work, follow `apps/mobile/AGENTS.md`; Milestone 01 resolves the existing Expo 54/package versus Expo 56/instruction mismatch before feature work.

## Product boundary

Build competitive amateur football infrastructure for an Algiers pilot:

```text
team → availability → recommendation → challenge → accepted agreement
→ pitch booking → scheduled match → owner/team outcomes
→ three hidden score submissions → verified result → Elo and reliability
```

Do not add social feeds, general chat, online payments, individual Elo, unverified player performance statistics, sportsmanship reviews, automatic match assignment, tournaments, dynamic pricing, or multi-city features.

## Locked defaults

- Currency: `DZD`; store integer minor units plus the currency code.
- Timezone: persist UTC; render `Africa/Algiers`.
- Formats: `FIVE_A_SIDE`, `SEVEN_A_SIDE`, `ELEVEN_A_SIDE`.
- New-team Elo: `1000`; K-factor: `32`.
- Recommendation defaults: 10 km and ±150 Elo.
- Availability lead time: six hours.
- Challenge response: earlier of creation + 24 hours or play-window start − 4 hours.
- Organizer booking: earlier of acceptance + 24 hours or play-window start − 2 hours.
- Owner booking response: earlier of request + 12 hours or booking start − 1 hour.
- Late cancellation: within six hours of booking start.
- Score submission deadline: match end + 48 hours.
- Provisional-majority dispute window: 24 hours.
- Reliability stays `NEW` until three resolved team-responsible outcomes.

## Architecture rules

- Keep one Express and TypeScript deployable.
- Modules use route → controller → service → repository.
- Shared Zod schemas and inferred types are the contract source of truth.
- A module may import another module's public service, never its repository.
- A repository accesses only tables owned by its module.
- Cross-module atomic transitions use `apps/api/src/lib/transaction.ts` and public services that accept a transaction context.
- PostgreSQL owns durable state. Redis/BullMQ may schedule and deliver work but must re-read PostgreSQL before acting.
- Every lifecycle mutation checks authorization, current state, deadline, and idempotency.
- Original reports and score submissions are immutable.

## Canonical module and contract files

| Concern                       | Shared contract      | API module      |
| ----------------------------- | -------------------- | --------------- |
| Users/auth                    | `user.ts`, `auth.ts` | `users`, `auth` |
| Teams/cards/lineups           | `team.ts`            | `teams`         |
| Pitches/inventory             | `pitch.ts`           | `pitches`       |
| Availability/challenges       | `matchmaking.ts`     | `matchmaking`   |
| Bookings/outcomes/reliability | `booking.ts`         | `bookings`      |
| Matches/results/disputes      | `match.ts`           | `matches`       |
| Elo/history/leaderboards      | `rating.ts`          | `ratings`       |
| Notifications                 | `notification.ts`    | `notifications` |
| Admin queues/resolutions      | domain files above   | `admin`         |

Every new shared file must be exported from `packages/shared/src/index.ts`. Every public method must be added to `packages/api-client/src/index.ts` in the same task that exposes its endpoint.

## Canonical public types

Use these names consistently:

```ts
type MatchFormat = "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "ELEVEN_A_SIDE";
type TeamStatus = "ACTIVE" | "ARCHIVED";
type CurrencyCode = "DZD";
type Money = { amountMinor: number; currency: CurrencyCode };
type AvailabilityStatus = "OPEN" | "MATCHED" | "CANCELLED" | "EXPIRED";
type ChallengeStatus =
  "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
type BookingStatus =
  | "PENDING_OWNER_CONFIRMATION"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED_BY_TEAM"
  | "CANCELLED_BY_OWNER"
  | "EXPIRED";
type OfflinePaymentStatus = "UNPAID" | "PAID_AT_VENUE" | "WAIVED";
type BookingTeamOutcomeType =
  "COMPLETED" | "NO_SHOW" | "LATE_CANCELLATION" | "EXCLUDED_OWNER_CANCELLATION";
type BookingTeamOutcomeState =
  "PENDING_RESPONSE" | "ACCEPTED" | "DISPUTED" | "RESOLVED";
type MatchStatus =
  | "SCHEDULED"
  | "AWAITING_RESULTS"
  | "CONSENSUS_PENDING"
  | "VERIFIED"
  | "DISPUTED"
  | "CANCELLED"
  | "NO_SHOW";
type ResultVerificationMethod =
  "UNANIMOUS" | "MAJORITY" | "CAPTAINS_AGREED" | "ADMIN_RESOLVED";
```

## Canonical endpoint namespaces

```text
/api/v1/auth
/api/v1/users
/api/v1/teams
/api/v1/pitches
/api/v1/matchmaking/availability
/api/v1/matchmaking/challenges
/api/v1/bookings
/api/v1/matches
/api/v1/ratings
/api/v1/notifications
/api/v1/admin
```

Keep static routes before `/:id` routes. Return `400` for validation, `401` for missing/invalid authentication, `403` for role or ownership violations, `404` for inaccessible resources, `409` for state/idempotency/inventory conflicts, and `422` for a syntactically valid command that violates accepted match conditions.

## Implementation discipline

For every task:

1. Inspect the named files and current git status.
2. Write the smallest failing unit or integration test for every listed behavior.
3. Run the focused test and confirm the expected failure.
4. Implement only the active prompt.
5. Run the focused test and confirm it passes.
6. Run the task verification commands.
7. Review the diff for boundary violations and unrelated changes.
8. Commit only the active prompt with the requested commit message.

Baseline commands confirmed on 2026-08-11:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

All three pass. The unit suite contains 10 passing API tests at baseline. Integration tests require PostgreSQL and Redis.

## Completion report

At the end of each prompt report:

- Files changed
- Tests written and their results
- Verification commands and results
- Migration name, when applicable
- Commit hash
- Any deviation from this context, with the reason

Do not claim completion when a required check was skipped or failed.
