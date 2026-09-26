# Milestone 10 — Booking Outcomes and Team Reliability

**Outcome:** Owners report each team's objective booking behavior; captains can dispute; only resolved team-responsible outcomes affect transparent reliability.

## M10-T01 — Define outcome, dispute, and reliability models

```text
Implement only M10-T01 with shared-schema and migration tests first.

Extend booking.ts and schema.prisma; create migration add_booking_outcomes_reliability.
Add BookingOutcomeReport (one per confirmed booking, owner, reportedAt, overall notes),
BookingTeamOutcome (one per booking/team, type, state PENDING_RESPONSE|ACCEPTED|DISPUTED|RESOLVED,
responseDeadline, finalizedAt), BookingOutcomeDispute (team outcome unique, captain, reason,
status OPEN|RESOLVED, createdAt/resolvedAt), and TeamReliability (teamId primary key, completed,
lateCancellations, noShows, resolvedCount, earnedQuarterPoints, percentage nullable, updatedAt).

Use integer quarter points: COMPLETED=4, LATE_CANCELLATION=1, NO_SHOW=0. Owner cancellation maps
both teams to EXCLUDED_OWNER_CANCELLATION and does not increment resolvedCount. Define public
summary and command schemas; notes/reasons are trimmed 1–500 characters.

Commit as:
feat(bookings): add outcome and reliability models
```

## M10-T02 — Implement the reliability calculator

```text
Implement only M10-T02 with pure unit tests first.

Create reliability.ts and reliability.test.ts in bookings. Export
calculateReliability(outcomes): { label: "NEW" | "RELIABLE" | "AT_RISK"; percentage: number | null;
completed; lateCancellations; noShows; resolvedCount; earnedQuarterPoints }.

Exclude owner cancellations and unresolved/disputed rows. If resolvedCount < 3, percentage is null
and label NEW. Otherwise percentage = round(100 * earnedQuarterPoints / (resolvedCount * 4)).
Use RELIABLE for percentage >= 80 and AT_RISK below 80; counts are always visible. Test zero, one,
three, mixed, excluded, disputed, and exact 80 boundary.

Commit as:
feat(bookings): calculate transparent reliability
```

## M10-T03 — Implement owner outcome reporting

```text
Implement only M10-T03 with integration tests first.

Implement reportBookingOutcome(ownerId, bookingId, input, now). Only the pitch owner may report,
once, within 24 hours after scheduled end. For a played CONFIRMED booking, require one outcome for
each team using COMPLETED or NO_SHOW. For CANCELLED_BY_OWNER, require both
EXCLUDED_OWNER_CANCELLATION. For a late CANCELLED_BY_TEAM booking, require LATE_CANCELLATION for the
recorded responsible team and COMPLETED for the other team. An early team cancellation creates no
reputation report. Store the cancellation actor/time as immutable evidence.
Set each response deadline to reportedAt + 24 hours. Store immutable report/team rows and do not
update reliability yet. Idempotent retry returns the report; changed payload conflicts.

Tests cover a reliable team receiving COMPLETED while opponent receives NO_SHOW, invalid mixed
owner cancellation, early/late report, wrong owner, and retry.

Commit as:
feat(bookings): let owners report team outcomes
```

## M10-T04 — Implement captain response and automatic finalization

```text
Implement only M10-T04 with transition and integration tests first.

Implement acceptTeamOutcome(captainId, teamOutcomeId, now), disputeTeamOutcome(captainId,
teamOutcomeId, reason, now), and finalizeDueTeamOutcomes(now, tx?). Only the designated match captain
for that team responds. Acceptance or undisputed deadline atomically finalizes the outcome and
recomputes TeamReliability from all resolved outcomes. Dispute creates one immutable dispute and
does not change reliability. Commands are idempotent; opposite/stale transitions return 409.

Use bookings-owned repositories only. Tests cover deadline boundaries, captain transfer after the
match, duplicate commands, and independent finalization for each team.

Commit as:
feat(bookings): finalize objective team outcomes
```

## M10-T05 — Add admin outcome resolution

```text
Implement only M10-T05 with integration tests first.

Create the standard admin module and mount /api/v1/admin. Add:
- GET /api/v1/admin/booking-outcome-disputes
- POST /api/v1/admin/booking-outcome-disputes/:id/resolve

Resolution input is { outcome: BookingTeamOutcomeType; reason: 1..500 }. Require ADMIN. Preserve
owner report and captain dispute. Store resolverId, selected outcome, reason, and resolvedAt.
Atomically mark resolved and recompute only the affected team's reliability. Repeated identical
resolution returns current result; changed second resolution is 409.

Tests cover non-admin denial, audit fields, changed outcome, excluded owner cancellation, and one
projection update.

Commit as:
feat(admin): resolve booking outcome disputes
```

## M10-T06 — Expose reputation APIs and operational UI

```text
Implement only M10-T06.

Add booking routes/client methods for owner report, captain accept/dispute, team reliability, and
viewer action queues. Build owner web outcome form and dispute status; build captain mobile outcome
review. Build narrow web admin dispute queue/resolution form. Every screen shows original report,
current state, deadline, counts, and explicit effect on reliability. Preserve reason input on error.

Read Expo/Next docs. Run mobile/web typecheck, web build, and endpoint integration tests.

Commit as:
feat(reputation-ui): connect outcome review flows
```

## M10-T07 — Integrate reliability into discovery and test races

```text
Implement only M10-T07.

Add bookings.service.getTeamReliabilityBatch(teamIds) and integrate it into recommendation and team
detail services; no repository cross-import. Recommendation score stays unchanged. Display NEW or
percentage plus counts beside Elo. Add concurrent accept/auto-finalize/admin-resolution tests proving
one final outcome and one projection update. Rebuild a projection from source outcomes in a test and
assert it equals stored TeamReliability.

Run booking/matchmaking integration tests, typecheck, lint, unit suite, mobile typecheck, and web build.

Commit as:
feat(reputation): display reliable team history
```

## Milestone 10 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
