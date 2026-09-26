# Milestone 01 — Baseline and Architecture Alignment

**Outcome:** The repository's documentation, runtime instructions, test foundation, and implementation status describe reality before domain expansion begins.

## M01-T01 — Produce a factual baseline audit

```text
Implement only M01-T01.

Read the root and nested AGENTS.md files, the approved design, git status, recent commits,
package scripts, Prisma schema, shared exports, API routes, mobile navigation, and web routes.

Create docs/baseline-audit-2026-08-11.md with a table for every current module and client
surface. Classify each as implemented, partial, stub, or absent. For every row cite exact
files and list the next milestone that owns the gap. Explicitly record:
- auth, users, teams, and pitches are implemented but incomplete;
- bookings, matches, social, and notifications routers are stubs;
- ratings, matchmaking, and admin modules do not exist;
- the current Prisma schema still stores rating and record fields on Team;
- apps/mobile/package.json uses Expo 54 while apps/mobile/AGENTS.md requires Expo 56;
- pnpm typecheck, pnpm lint, and pnpm test pass at this baseline;
- unrelated working-tree changes must not be modified.

Do not change runtime code. Verify every cited path with rg or Get-Content. Run:
git diff --check
pnpm typecheck

Commit only the audit as:
docs: record core MVP implementation baseline
```

## M01-T02 — Align the mobile SDK toolchain

```text
Implement only M01-T02.

Files:
- Modify apps/mobile/package.json, apps/mobile/app.json, pnpm-lock.yaml only as required.
- Modify apps/mobile/AGENTS.md only if the official Expo 56 guide requires a corrected URL.

Follow apps/mobile/AGENTS.md. Read the official Expo SDK 56 upgrade guide before editing.
Upgrade apps/mobile from Expo 54 to Expo 56 using Expo's supported upgrade/install commands;
do not guess React Native or Expo package versions. Preserve the existing app identifiers,
assets, EAS configuration, fonts, and navigation behavior.

Verification:
- pnpm install completes without a peer-dependency error.
- pnpm --filter @footconnect/mobile exec expo-doctor reports no blocking issue.
- pnpm --filter @footconnect/mobile typecheck passes.
- pnpm typecheck passes.

If Expo 56 is not available to the configured registry, stop with command output and make no
partial dependency commit. Do not add product features.

Commit as:
chore(mobile): align app with Expo SDK 56
```

## M01-T03 — Centralize API integration-test fixtures

```text
Implement only M01-T03 using TDD/refactor discipline.

Files:
- Create apps/api/src/test/integration-helpers.ts.
- Modify apps/api/src/modules/auth/auth.integration.test.ts.
- Modify apps/api/src/modules/teams/teams.integration.test.ts.
- Modify apps/api/src/modules/pitches/pitches.integration.test.ts.

Create exact reusable helpers:
- registerTestUser(app, overrides) returning { accessToken, user };
- authHeader(token) returning { Authorization: `Bearer ${token}` };
- uniqueEmail(prefix) using randomUUID rather than Date.now;
- disconnectTestDependencies() for Prisma and Redis cleanup.

Refactor existing integration tests to use the helpers without changing their assertions or
production code. Cleanup must delete only IDs/emails created by the current test file.

Run the integration suite before the refactor and record the baseline. After refactoring run:
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/api typecheck
pnpm test

Expected: the same integration behaviors pass and no test relies on execution order outside
its describe block.

Commit as:
test(api): centralize integration fixtures
```

## M01-T04 — Correct architecture and status documentation

```text
Implement only M01-T04.

Files:
- Modify docs/architecture.md.
- Modify README.md.
- Modify apps/api/src/modules/README.md.

Use docs/baseline-audit-2026-08-11.md and the approved design as sources. Change the product
positioning to competitive amateur football infrastructure. Replace challenge-only wording
with recommendations plus captain-controlled challenges. Replace the old challenge-to-
reservation flow with agreement first and organizer booking second. Document the three-party
score consensus and team reliability. Replace the stale phase status with the factual module
status and link to the approved design and implementation-plan index.

Keep the modular-monolith rule and current stack. Mark social and online payments deferred.
Do not duplicate the 428-line design spec inside architecture.md; summarize and link it.

Verification:
- rg finds no statement that Phase 0 is the current milestone.
- rg finds no locked "no auto-match algorithm" text that excludes recommendations.
- Every roadmap milestone links to the prompt-pack index.
- pnpm exec prettier --check README.md docs/architecture.md apps/api/src/modules/README.md

Commit as:
docs: align architecture with competitive core MVP
```

## Milestone 01 gate

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @footconnect/api test:integration
git diff --check
```
