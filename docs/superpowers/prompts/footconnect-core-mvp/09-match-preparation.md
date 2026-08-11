# Milestone 09 — Match Preparation

**Outcome:** Confirmed bookings become understandable upcoming fixtures with immutable captains, participants, and match lineups.

## M09-T01 — Complete match read models and APIs

```text
Implement only M09-T01 with integration tests first.

Expand packages/shared/src/match.ts with MatchSummary and MatchDetail. Complete matches routes,
controller, service, and repository. Expose:
- GET /api/v1/matches/mine?state=upcoming|past
- GET /api/v1/matches/owner
- GET /api/v1/matches/:id

Player access requires active membership in either participating team; designated captains retain
access if their membership later changes; pitch owner and ADMIN have scoped access. Match detail
contains public teams, pitch, UTC schedule plus Africa/Algiers label data, format, booking price/
payment state, designated captains, status, and viewer actions. Add ApiClient methods and pagination.

Tests cover every viewer, chronological order, privacy, and no result fields before submission.

Commit as:
feat(matches): expose scheduled fixtures
```

## M09-T02 — Snapshot match lineups

```text
Implement only M09-T02 with migration and service tests first.

Add MatchLineupSnapshot owned by matches and MatchLineupPlayer rows with matchId, teamId,
formationCode, submittedById, submittedAt, userId, displayName snapshot, avatarUrl snapshot,
primaryPosition snapshot, positionCode, and sortOrder. Enforce one snapshot per match/team and
unique user/sort order within it.

Implement submitMatchLineup(actorId, matchId, teamId, input). Only the designated captain for that
team may submit before match start. Validate against active membership and format rules through
teams.service; do not import teams.repository. First submission creates an immutable snapshot.
Before the deadline, replacement is allowed only through an audited replace command that retains
the previous snapshot version. After start, return 409.

Tests cover both teams, wrong captain, wrong format/count, inactive player, duplicate, replacement,
and deadline.

Commit as:
feat(matches): snapshot match lineups
```

## M09-T03 — Add lineup and fixture client methods

```text
Implement only M09-T03 with endpoint integration tests first.

Routes:
- GET /api/v1/matches/:id/lineups
- PUT /api/v1/matches/:id/lineups/:teamId

Add shared input/response schemas and ApiClient methods. Match detail viewerActions must include
canSubmitLineup and lineupDeadline. Return the latest snapshot and version history only to the
owning team captain/admin; other viewers see the final current public lineup.

Tests cover hidden history, current snapshot visibility, authorization, and request validation.

Commit as:
feat(matches): expose match lineup workflow
```

## M09-T04 — Build upcoming fixture experience

```text
Implement only M09-T04.

Mobile: create UpcomingMatchesScreen and MatchDetailScreen; update HomeScreen next fixture. Show
teams, FootConnect cards/formation, Algiers time, pitch, map/address copy, format, booking state,
and captain lineup action. Provide calendar/share-friendly text without adding chat.

Web: show confirmed matches in the owner schedule and link to a read-only match detail.

Read Expo/Next docs. Use query keys by matchId and invalidate after lineup submission. Handle
cancelled/no-show states, loading, empty, forbidden, and retry. Run mobile/web typecheck and web build.

Commit as:
feat(fixtures): add upcoming match experience
```

## M09-T05 — Verify match preparation invariants

```text
Implement only M09-T05.

Add integration coverage proving one confirmed booking creates one match, participant and captain
snapshots do not change after team edits, lineup members were active at submission, two teams cannot
write each other's lineup, and booking confirmation rollback leaves no orphan match/snapshot.
Make matches.repository.findMatchesForViewer return the required participant, pitch, and booking
projection in one Prisma query. Add a service unit test that spies on this repository method and
asserts one call for a multi-row list response. Replace the temporary team-archive no-match adapter
from M04-T06 with matches.service.hasFutureConfirmedMatch(teamId).

Run matches/bookings integration tests, typecheck, lint, and unit suite.

Commit as:
test(matches): enforce fixture snapshot invariants
```

## Milestone 09 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
