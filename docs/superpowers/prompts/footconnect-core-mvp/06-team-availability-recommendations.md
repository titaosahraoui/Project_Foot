# Milestone 06 — Team Availability and Opponent Recommendations

**Outcome:** Captains publish valid looking-for-match windows and receive explainable, eligible local opponents.

## M06-T01 — Define availability contracts and persistence

```text
Implement only M06-T01 with shared-schema and migration tests first.

Files:
- Create packages/shared/src/matchmaking.ts and export it from index.ts.
- Modify schema.prisma and create migration add_team_availability.
- Create the standard matchmaking module files and mount its router in app.ts.

Add TeamAvailability with teamId, createdById, startAt/endAt UTC, MatchFormat, origin lat/lng,
radiusKm, eloTolerance, message, AvailabilityStatus, expiresAt, matchedAt, cancelledAt, createdAt,
and updatedAt. Validate duration 60–240 minutes, start at least six hours ahead, radius 1–50 km,
Elo tolerance 50–500, message <= 280, and creator-provided origin within coordinate bounds.

Create response schemas with public approximate area, not raw opponent coordinates. Add repository
create/find/list/update methods but no recommendation logic yet.

Tests prove schema boundaries, defaults 10 km/±150, and Prisma enum/default persistence.

Commit as:
feat(matchmaking): add team availability model
```

## M06-T02 — Implement availability lifecycle rules

```text
Implement only M06-T02 with unit and integration tests first.

Create apps/api/src/modules/matchmaking/availability-rules.ts and tests. Implement service methods:
createAvailability(actorId, input), listMyAvailability(actorId), cancelAvailability(actorId, id),
and expireDueAvailability(now, tx?). Only the active captain can create/cancel. A team may not have
overlapping OPEN windows. Cancellation and expiry are idempotent; MATCHED availability cannot be
cancelled through this command. Expire when endAt or expiresAt is past.

Integration tests cover captain/member/unrelated access, overlaps, deadline validation, repeated
cancel/expire calls, and no exposure of private coordinates.

Commit as:
feat(matchmaking): enforce availability lifecycle
```

## M06-T03 — Implement recommendation eligibility and score

```text
Implement only M06-T03 with pure unit tests first.

Create recommendation-score.ts and recommendation-score.test.ts in matchmaking. Export:
- overlapMinutes(aStart, aEnd, bStart, bEnd);
- haversineKm(a, b);
- scoreRecommendation({ eloDifference, mutualEloTolerance, distanceKm, mutualRadiusKm });

Eligibility requires different teams, both active with an active captain, OPEN overlapping
availability, exact format match, distance within min(radiusA, radiusB), and Elo difference within
min(toleranceA, toleranceB). Score exactly:
elo = 1 - min(diff / mutualTolerance, 1)
distance = 1 - min(distance / mutualRadius, 1)
score = round(100 * (0.65 * elo + 0.35 * distance))

Test boundary 0/100 scores, exact radius/tolerance, non-overlap, adjacent windows, format mismatch,
and Algiers coordinate examples. Reliability is not a score input.

Commit as:
feat(matchmaking): add explainable recommendation score
```

## M06-T04 — Expose availability and recommendation APIs

```text
Implement only M06-T04 with integration tests first.

Routes:
- POST /api/v1/matchmaking/availability
- GET /api/v1/matchmaking/availability/mine
- DELETE /api/v1/matchmaking/availability/:id
- GET /api/v1/matchmaking/availability/:id/recommendations

The recommendation endpoint requires the availability team's captain, pages results, calls
ratings.service for Elo, and returns team summary, overlapping window, format, rounded distance,
Elo difference, 0–100 score, explanation fields, and reliability null. Null means `NEW` until
Milestone 10 integrates bookings.service. Sort score descending, then distance ascending, then
team ID for deterministic ties. Add exact ApiClient methods and shared response types.

Tests cover filters, deterministic order, pagination, privacy, and authorization.

Commit as:
feat(matchmaking): expose recommendations API
```

## M06-T05 — Build captain availability controls

```text
Implement only M06-T05.

Create mobile screens/components for LookingForMatch list and editor; add typed navigation from
Play. Captains choose team, format, local date/time, radius, Elo tolerance, and message. Convert
local Algiers input to UTC once. Members see read-only team availability and a captain-only notice.
Show OPEN/MATCHED/CANCELLED/EXPIRED states, countdown/deadline copy, cancel confirmation, field
errors, and retry.

Do not request recommendations until the availability create response succeeds. Do not add
challenge actions in this task.

Run mobile typecheck and manual cases for each format, invalid lead time, offline retry, and member.

Commit as:
feat(mobile): add looking-for-match controls
```

## M06-T06 — Build recommended-opponent results

```text
Implement only M06-T06.

Create RecommendedOpponentsScreen and focused components. Display team name/logo, Elo, distance,
format, overlap, recommendation percentage, explanation, and reliability `NEW`. Provide View Team
only; challenge action arrives in Milestone 07. Handle no local teams with pilot-friendly copy and
a way to edit availability. Never display raw coordinates.

Use TanStack Query with the availability ID in the key. Verify refresh, pagination, empty, expired
availability, and API error states. Run mobile typecheck.

Commit as:
feat(mobile): show recommended opponents
```

## M06-T07 — Close recommendation edge cases

```text
Implement only M06-T07.

Add integration tests with at least six teams proving exclusion for own team, inactive team,
missing captain, non-overlap, format mismatch, radius, Elo tolerance, and already MATCHED state.
Prove deterministic ranking for ties and that repository query count does not grow once per
candidate team. Add and use ratings.service.getTeamRatingsBatch(teamIds); do not import
ratings.repository.

Run focused unit/integration tests, typecheck, lint, and the API unit suite.

Commit as:
test(matchmaking): cover recommendation eligibility
```

## Milestone 06 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
