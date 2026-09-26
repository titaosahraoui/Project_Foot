# Milestone 12 — Elo, Rating History, and Leaderboards

**Outcome:** One verified result atomically updates two team ratings, immutable histories, records, and competitive product surfaces.

## M12-T01 — Implement standard team Elo

```text
Implement only M12-T01 with pure unit tests first.

Create apps/api/src/modules/ratings/elo.ts and elo.test.ts. Export expectedScore(rating, opponent)
and calculateEloDelta(homeRating, awayRating, homeScore, awayScore, kFactor=32).

Use expected = 1 / (1 + 10 ** ((opponent - rating) / 400)). Actual is 1/0.5/0. Calculate one rounded
home delta with Math.round and set away delta to its exact negative so the pair is zero-sum. Return
before, expected, actual, delta, and after for both teams. Ratings may not become negative.

Test equal-rating win/draw/loss, favorite win, upset, zero-score draw, high ratings, rounding symmetry,
and unchanged inputs.

Commit as:
feat(ratings): implement team Elo calculation
```

## M12-T02 — Add immutable rating history

```text
Implement only M12-T02 with migration and integration tests first.

Extend schema.prisma and rating.ts; create migration add_rating_history. Add RatingHistory with teamId,
opponentTeamId, matchId, ratingBefore, expectedScore Decimal, actualScore Decimal, ratingChange,
ratingAfter, createdAt, and unique matchId+teamId. Add indexes teamId+createdAt and matchId.

Define TeamRatingSummary, RatingHistoryEntry, and leaderboard schemas. Repository methods remain in
ratings. Test persistence precision and unique constraint.

Commit as:
feat(ratings): add immutable rating history
```

## M12-T03 — Apply ratings atomically and idempotently

```text
Implement only M12-T03 with integration tests first.

Implement ratings.service.applyVerifiedResult(input, tx), where input contains matchId, both team IDs,
homeScore, awayScore, and verificationMethod. matches.service calls it with its newly verified result;
ratings.service does not read matches tables. In one shared transaction, lock both TeamRating rows in
deterministic team-ID order, calculate from both pre-match ratings, update rating and matchesPlayed/
wins/draws/losses, and insert two RatingHistory rows. After it returns, matches.service marks rating
application on its MatchResult within the same transaction.

If histories already exist, return them unchanged. Any failure rolls back both team rows, histories,
and match application marker. Cancelled/no-show/unverified matches return 409 and never change ratings.

Tests cover every result method, retry, concurrent replay, rollback, draw, upset, and zero-sum delta.

Commit as:
feat(ratings): apply verified results atomically
```

## M12-T04 — Expose ratings, history, and Algiers leaderboard

```text
Implement only M12-T04 with integration tests first.

Create ratings routes/controller and mount them:
- GET /api/v1/ratings/teams/:teamId
- GET /api/v1/ratings/teams/:teamId/history
- GET /api/v1/ratings/leaderboard?area=algiers&page=&pageSize=

Leaderboard includes only active Algiers teams with at least one verified match, ordered rating desc,
wins desc, team ID. Return rank, team public summary, rating, W/D/L, matches, and reliability summary
through bookings.service. History is newest first and shows opponent, score, before/change/after, and
verification method. Add ApiClient methods.

Tests cover ranking ties, pagination, zero-match exclusion, privacy, and no N+1 repository calls.

Commit as:
feat(ratings): expose competitive standings
```

## M12-T05 — Integrate competitive team and home experiences

```text
Implement only M12-T05.

Mobile TeamDetail: add rating history and record. Home: show active team Elo, Algiers rank,
reliability, next match, pending actions, and recommended opponents. Add LeaderboardScreen from Teams
or Home. Show rating movement such as `1292 → +24 → 1316`, result verification method, loading/empty/
error states, and NEW reliability. Do not create social feed content.

Web match detail: show verified result and rating changes read-only.

Run mobile/web typecheck, web build, and manual checks for no team, new team, ranked team, draw, upset,
and long team names.

Commit as:
feat(competition-ui): show Elo and standings
```

## M12-T06 — Verify one-result-one-rating invariant

```text
Implement only M12-T06.

Add an end-to-end integration scenario creating two teams and a verified result through service/API
boundaries, then invoke unanimous verification, deadline processing, and admin replay concurrently.
Assert exactly two histories, one update per team, zero-sum delta, correct W/D/L, and stable leaderboard.
Add a migration/data invariant query ensuring every VERIFIED match has zero or two histories, never one;
document zero as a repairable pre-application state and expose it in logs.

Run ratings/matches integration suites, typecheck, lint, and unit suite.

Commit as:
test(ratings): prove idempotent Elo application
```

## Milestone 12 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
