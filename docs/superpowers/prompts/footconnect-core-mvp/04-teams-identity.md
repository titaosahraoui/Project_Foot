# Milestone 04 — Teams and Competitive Identity

**Outcome:** Teams have one transferable captain, a derived FootConnect card for every active member, valid format-specific lineups, and ratings-owned competitive state.

## M04-T01 — Establish ratings ownership

```text
Implement only M04-T01 with migration and integration tests first.

Files:
- Modify apps/api/prisma/schema.prisma and create migration move_team_rating.
- Create apps/api/src/modules/ratings/ratings.repository.ts and ratings.service.ts.
- Modify apps/api/src/modules/teams/teams.service.ts and teams.integration.test.ts.
- Modify packages/shared/src/team.ts.

Add TeamRating with teamId primary/foreign key, rating default 1000, matchesPlayed, wins, draws,
losses, createdAt, and updatedAt. Migrate current Team.skillRating/wins/losses into TeamRating,
then remove those columns from Team. The ratings repository owns TeamRating. Export
getTeamRating(teamId, tx?) and createInitialTeamRating(teamId, tx?). Team creation must create
the Team and TeamRating atomically through public services and the shared transaction context.

Team responses continue exposing rating and record through shared TeamSummary.competitive, but
teams.service obtains that data from ratings.service rather than the ratings repository.

Tests prove new teams start at 1000 and zero records, existing values migrate, and failed rating
creation rolls back team creation.

Commit as:
refactor(teams): move competitive state to ratings
```

## M04-T02 — Implement captain transfer

```text
Implement only M04-T02 with integration tests first.

Files:
- Modify packages/shared/src/team.ts.
- Modify teams routes/controller/service/repository and teams.integration.test.ts.
- Modify packages/api-client/src/index.ts.

Add transferCaptainSchema { newCaptainUserId: UUID } and POST
/api/v1/teams/:id/captain-transfer. Only the current active captain may transfer to an active
member. In one transaction, demote the old captain to MEMBER and promote the target to CAPTAIN.
Reject self-transfer, inactive/non-member targets, and concurrent stale transfers with 409.
Preserve exactly one active CAPTAIN. Add ApiClient.transferTeamCaptain.

Tests include successful transfer, former captain forbidden afterward, non-captain forbidden,
target not active, and captain now able to leave only after transfer.

Commit as:
feat(teams): add atomic captain transfer
```

## M04-T03 — Define FootConnect player cards

```text
Implement only M04-T03 with shared-schema tests first.

Files:
- Modify packages/shared/src/team.ts.
- Modify apps/api/src/modules/teams/teams.service.ts and repository.ts.
- Modify teams integration tests.

Do not add a duplicate PlayerCard table. Define playerCardSchema as a public projection of an
active User and TeamMembership: userId, displayName, avatarUrl, primaryPosition, teamRole,
joinedAt, verifiedAppearances, and cardTheme fixed to "FOOTCONNECT_BASE". Add these cards to
TeamDetail.members. verifiedAppearances is zero until match snapshots exist and later becomes a
count of verified match-lineup participation through matches.service in Milestone 09, never direct
match-table access from teams.repository. In this task always return zero.

Tests prove private user fields never appear, inactive members are excluded, null avatars are
valid, and appearances begin at zero.

Commit as:
feat(teams): expose FootConnect player cards
```

## M04-T04 — Add formations and current lineups

```text
Implement only M04-T04 with unit and integration tests first.

Files:
- Modify schema.prisma and create migration add_team_lineups.
- Modify packages/shared/src/team.ts.
- Modify teams routes/controller/service/repository.
- Create apps/api/src/modules/teams/lineup-rules.ts and lineup-rules.test.ts.
- Modify teams.integration.test.ts and packages/api-client/src/index.ts.

Add TeamLineup owned by teams with teamId + format unique, formationCode, updatedById,
updatedAt, and ordered TeamLineupSlot rows containing userId, positionCode, and sortOrder.
Supported formation codes are 1-2-1 for 5v5, 2-3-1 for 7v7, and 4-4-2 for 11v11, each counting
the goalkeeper. Position codes are exactly GK/LB/RB/CM/ST for 5v5; GK/LCB/RCB/LM/CM/RM/ST for
7v7; and GK/LB/LCB/RCB/RB/LM/LCM/RCM/RM/LST/RST for 11v11. PUT
/api/v1/teams/:id/lineups/:format replaces a lineup atomically.

Only the active captain may edit. Require exactly the format's player count, one GK, unique
active team members, unique sort orders from zero, and positions compatible with the formation.
GET /api/v1/teams/:id/lineups returns all saved lineups. Add matching client methods.

Tests cover every validation rule and rollback on one invalid slot.

Commit as:
feat(teams): add validated team formations
```

## M04-T05 — Build team cards and lineup UI

```text
Implement only M04-T05.

Files:
- Modify apps/mobile/src/screens/TeamDetailScreen.tsx.
- Modify apps/mobile/src/components/ui/PlayerCard.tsx.
- Create apps/mobile/src/components/team/FormationBoard.tsx and LineupEditor.tsx.
- Modify apps/mobile/src/navigation.ts if a dedicated editor screen is needed.

Read Expo 56 documentation first. Render original FootConnect styling without EA names, logos,
or card artwork. Show roster cards, Elo/record from TeamDetail.competitive, captain marker,
reliability placeholder `NEW`, and formation board. Captains can select a supported format,
assign eligible members once, save, and recover from validation/API errors. Members see a
read-only lineup. Keep touch targets accessible and do not encode status only by color.

Run:
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck

Manually verify captain/member permissions, 5v5/7v7/11v11 layouts, empty roster, and failed save.

Commit as:
feat(mobile): add team cards and lineup editor
```

## M04-T06 — Add team lifecycle and close authorization gaps

```text
Implement only M04-T06 with migration and integration tests first.

Add TeamStatus ACTIVE|ARCHIVED to shared contracts and Team, default ACTIVE. Add captain-only POST
/api/v1/teams/:id/archive and /reactivate commands. Archive is allowed only when the team has no
future confirmed match; query that condition through matches.service after Milestone 09, and until
then enforce the locally available no-match baseline through a teams-owned adapter returning false.
Archived teams remain visible in history but cannot publish availability or receive challenges.

Review all team endpoints and add a table-driven authorization suite covering anonymous user,
unrelated player, active member, active captain, and ADMIN. Public team detail exposes only the public
projection. All team mutation endpoints use one shared assertActiveCaptain service helper. Test
concurrent invitation acceptance, duplicate active membership, captain removal, transfer races,
archive/reactivate idempotency, and archived mutation rejection.

Run:
pnpm --filter @footconnect/api test:integration -- teams.integration.test.ts
pnpm typecheck
pnpm lint

Commit as:
feat(teams): enforce team lifecycle invariants
```

## Milestone 04 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
