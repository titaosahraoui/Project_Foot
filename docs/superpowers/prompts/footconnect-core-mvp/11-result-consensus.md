# Milestone 11 — Three-Party Result Consensus

**Outcome:** Two designated captains and the pitch owner submit hidden scores; deterministic consensus or audited administration yields one verified result.

## M11-T01 — Define result persistence and contracts

```text
Implement only M11-T01 with schema/migration tests first.

Extend match.ts and schema.prisma; create migration add_match_result_consensus. Add
MatchResultSubmission with matchId, submitterUserId, role HOME_CAPTAIN|AWAY_CAPTAIN|PITCH_OWNER,
homeScore, awayScore, submittedAt, and a unique matchId+role constraint. Add MatchResult with
matchId unique, scores, verificationMethod, verifiedAt, and verifiedById nullable. Add
MatchResultDispute with openedById, reason, status, resolution fields, and audit timestamps.

Scores are integers 0–99 and always use canonical home/away orientation. Define hidden viewer
response types: before a viewer submits, return only submitted role count; after submission or
consensus closure, return allowed details. Original submissions are immutable.

Commit as:
feat(matches): add result consensus persistence
```

## M11-T02 — Implement the pure consensus engine

```text
Implement only M11-T02 with exhaustive table-driven unit tests first.

Create result-consensus.ts and tests. Export evaluateConsensus(submissions, deadlinePassed) returning:
- AWAITING_SUBMISSIONS;
- VERIFY_UNANIMOUS with score;
- START_MAJORITY_PENDING with score and dissentingRole;
- VERIFY_CAPTAINS_AGREED with score;
- DISPUTED with reason ALL_DIFFERENT or NO_AGREEMENT.

Rules: three equal verifies unanimous; three with two equal starts majority; three different disputes;
before deadline any missing role waits; after deadline matching captains with missing owner verifies
CAPTAINS_AGREED; after deadline two matching with one missing captain starts majority; fewer than two
matching after deadline disputes. Test all score permutations without relying on submission order.

Commit as:
feat(matches): implement three-party consensus engine
```

## M11-T03 — Accept hidden independent submissions

```text
Implement only M11-T03 with integration tests first.

Implement submitResult(actorId, matchId, input, idempotencyKey, now). Authorize exactly the snapshotted
home captain, away captain, or pitch owner. Match must have ended and be SCHEDULED/AWAITING_RESULTS.
Insert the role's immutable submission, evaluate consensus in the same transaction, and move match
state accordingly. Idempotent identical retry returns the submission state; changed score conflicts.

Until the actor submits, response reveals only which roles have submitted, never scores. After their
submission, show their score only. On unanimous verification candidate, call the booking-outcome
compatibility gate before creating MatchResult; do not update Elo in this milestone.

Tests cover hidden data, all roles, wrong captain/owner, early submit, duplicate role, retries, and
unanimous state.

Commit as:
feat(matches): collect hidden score submissions
```

## M11-T04 — Implement majority windows and deadline processing

```text
Implement only M11-T04 with fixed-clock tests first.

Add MatchConsensusWindow with matchId unique, proposed scores, dissentingRole nullable, opensAt,
closesAt, and status OPEN|DISPUTED|VERIFIED. Implement processResultDeadlines(now, tx?) and
finalizeConsensusWindows(now, tx?). START_MAJORITY_PENDING creates one 24-hour window and match
CONSENSUS_PENDING. No dispute before closesAt verifies MAJORITY. Matching captains with missing owner
at the 48-hour deadline verifies CAPTAINS_AGREED without a majority window. All commands are retry-safe.

Tests cover exact deadline instants, delayed job replay, late third submission before close, and no
duplicate result/window.

Commit as:
feat(matches): process result consensus deadlines
```

## M11-T05 — Add result disputes and booking-outcome gate

```text
Implement only M11-T05 with integration tests first.

Allow the dissenting role to POST a reason during an OPEN majority window. All-different/no-agreement
cases create a system dispute. Before any MatchResult verifies, call bookings.service to assert both
resolved team outcomes are COMPLETED. Pending outcomes delay final verification; NO_SHOW,
LATE_CANCELLATION, or EXCLUDED_OWNER_CANCELLATION creates an outcome-conflict dispute. Do not import
bookings.repository.

Tests cover dissenting/non-dissenting actors, deadline, outcome pending, conflicting no-show, and
successful completed outcomes.

Commit as:
feat(matches): gate results with booking outcomes
```

## M11-T06 — Add audited admin result resolution

```text
Implement only M11-T06 with integration tests first.

Admin routes:
- GET /api/v1/admin/match-result-disputes
- POST /api/v1/admin/match-result-disputes/:id/resolve

Input is homeScore, awayScore, and reason 1–500. Require ADMIN. Store selected score, resolver, reason,
resolvedAt, create MatchResult with ADMIN_RESOLVED, and set Match VERIFIED only after the booking-
outcome gate permits play. Preserve all submissions/windows/disputes. Identical retry is idempotent;
changed second resolution conflicts.

Commit as:
feat(admin): resolve match result disputes
```

## M11-T07 — Expose result flows in mobile and owner web

```text
Implement only M11-T07.

Add match routes/client methods for submit, status, majority dispute, and admin resolution. Build
captain mobile score form/status and pitch-owner web score form/status. Build admin result queue.
Before submission show no scores; after submission show only the actor's score until consensus closes.
Clearly label UNANIMOUS, MAJORITY_PENDING, CAPTAINS_AGREED, DISPUTED, and ADMIN_RESOLVED. Prevent
double taps with stable idempotency keys while retaining retry.

Run integration tests, mobile/web typecheck, web build, and manually verify all consensus branches.

Commit as:
feat(results-ui): connect three-party consensus
```

## Milestone 11 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
