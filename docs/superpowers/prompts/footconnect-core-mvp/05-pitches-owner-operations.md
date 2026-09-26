# Milestone 05 — Pitches and Owner Operations

**Outcome:** Owners publish trustworthy DZD pricing and recurring availability; clients query exact Algiers inventory without overlapping closures.

## M05-T01 — Migrate pitch pricing to DZD money

```text
Implement only M05-T01 with migration and integration tests first.

Files:
- Modify schema.prisma and create migration migrate_pitch_money.
- Modify packages/shared/src/pitch.ts.
- Modify pitches service/repository and pitches.integration.test.ts.
- Modify packages/api-client/src/index.ts and current pitch UI formatters.

Replace Float pricePerHour with integer priceAmountMinor and currency fixed to DZD. Migrate an
existing value X to round(X * 100). Shared pitch create/update/response contracts use Money as
hourlyRate. Make `pitchSizeSchema` a deprecated alias of `matchFormatSchema` during the migration
and expose `format: MatchFormat` in final Pitch contracts so pitch and match formats cannot diverge.
Never use `$` copy. Reject negative, fractional-minor, unsafe integer, and non-DZD
values. Render examples as `4,000 DZD`, not `400000 DZD`.

Tests prove migration preservation, create/update/search serialization, max-price filtering in
minor units, and rejection of invalid currency.

Commit as:
refactor(pitches): store explicit DZD pricing
```

## M05-T02 — Replace slots with recurring availability rules

```text
Implement only M05-T02 with tests first.

Files:
- Modify schema.prisma and create migration replace_pitch_slots_with_rules.
- Modify packages/shared/src/pitch.ts.
- Modify pitches routes/controller/service/repository and integration tests.
- Modify packages/api-client/src/index.ts.

Rename the PitchSlot concept to PitchAvailabilityRule. Store dayOfWeek 0–6, startMinute and
endMinute 0–1440, timezone fixed to Africa/Algiers, isActive, createdAt, and updatedAt. Convert
existing HH:mm strings to minutes in the migration. Reject end <= start, overlapping active rules
for the same pitch/day, and rules shorter than 30 minutes.

Expose GET and PUT /api/v1/pitches/:id/availability-rules. PUT replaces the full rule set in one
transaction and is owner-only. Keep `getPitchSlots` and `createPitchSlots` as deprecated client
aliases that call the new rule endpoints so intermediate mobile code remains type-safe; remove both
aliases in M05-T06 after PlayScreen uses the new methods.

Tests cover replacement, rollback, overlap, ownership, and local-time serialization as HH:mm.

Commit as:
feat(pitches): add recurring availability rules
```

## M05-T03 — Add pitch closures and exact inventory queries

```text
Implement only M05-T03 with unit and integration tests first.

Files:
- Modify schema.prisma and create migration add_pitch_blocks.
- Modify packages/shared/src/pitch.ts.
- Create apps/api/src/modules/pitches/inventory.ts and inventory.test.ts.
- Modify pitches routes/controller/service/repository and integration tests.
- Modify packages/api-client/src/index.ts.

Add PitchBlock with pitchId, UTC startAt/endAt, reason, createdById, createdAt, and cancelledAt.
Expose owner-only POST /api/v1/pitches/:id/blocks and DELETE
/api/v1/pitches/:id/blocks/:blockId. Expose public GET
/api/v1/pitches/:id/available-slots?from=<UTC>&to=<UTC>&durationMinutes=<30..180>.

Generate exact UTC candidates from active recurring rules in Africa/Algiers, then subtract active
blocks. Return startAt, endAt, and Money. Limit queries to 31 days and preserve chronological
ordering. Booking subtraction is added in Milestone 08 through the inventory service's
`BlockingRange` input; define that interface now as { startAt: Date; endAt: Date }.

Tests cover week boundaries, invalid ranges, closures, multiple rules, duration fit, and UTC/
Algiers conversion.

Commit as:
feat(pitches): expose exact available inventory
```

## M05-T04 — Enforce pitch-owner role and ownership

```text
Implement only M05-T04 with table-driven integration tests first.

Apply requireRole("PITCH_OWNER", "ADMIN") to pitch creation and owner operational routes.
Resource ownership remains enforced in pitches.service; ADMIN may inspect but may not silently
edit an owner's commercial data. Add a documented test-only way to create users with roles via
database fixture mutation after registration; do not allow public registration to self-select
PITCH_OWNER or ADMIN.

Test anonymous, PLAYER, unrelated PITCH_OWNER, owning PITCH_OWNER, and ADMIN behavior for create,
update, rule replacement, block creation, and owner listing. Public search/detail/inventory remain
readable without authentication and expose no owner email.

Commit as:
test(pitches): enforce owner authorization
```

## M05-T05 — Build the owner schedule and availability UI

```text
Implement only M05-T05.

Read apps/web/AGENTS.md and relevant local Next.js 16 docs. Modify/create:
- apps/web/src/app/pitches/[id]/page.tsx
- apps/web/src/app/pitches/[id]/availability/page.tsx
- apps/web/src/components/pitches/AvailabilityRuleEditor.tsx
- apps/web/src/components/pitches/PitchCalendar.tsx
- apps/web/src/lib/format-money.ts and format-time.ts

Let owners edit full recurring rules, view exact slots for a selected week, add/remove closures,
and see DZD hourly rates. Use TanStack Query invalidation after mutations. Preserve form input on
errors. Show local Algiers labels and send UTC query boundaries. Provide loading, empty, forbidden,
conflict, and retry states.

Run web typecheck/build and manually verify a rule crossing a week boundary, closure removal,
mobile-width layout, keyboard navigation, and DZD formatting.

Commit as:
feat(web): add pitch availability calendar
```

## M05-T06 — Update mobile pitch discovery

```text
Implement only M05-T06.

Modify PlayScreen and create focused pitch components under apps/mobile/src/components/pitch/.
Replace dollar copy with DZD. Query exact inventory when a user opens a pitch and selects a date.
Show format, surface, distance when coordinates are known, local start/end, price, and closure-safe
empty state. This milestone is discovery only: do not add a Book button or create bookings.

Remove the deprecated `getPitchSlots` and `createPitchSlots` aliases from the API client after all
mobile call sites use availability-rule and exact-inventory methods.

Read Expo 56 docs first. Run mobile typecheck and manually verify loading, no inventory, API
failure/retry, 5v5/7v7/11v11 labels, and large text.

Commit as:
feat(mobile): show exact pitch inventory
```

## M05-T07 — Add pitch inventory regression coverage

```text
Implement only M05-T07.

Add focused unit/integration cases for daylight/timezone conversion using Africa/Algiers,
31-day query cap, overlapping rules, adjacent non-overlapping rules, active/inactive closures,
ownership, DZD serialization, and Haversine search. Replace the in-memory post-query radius filter
with a repository query appropriate for PostgreSQL if the integration test proves it reads all
rows; keep the public behavior identical.

Run the full pitch integration file, API unit suite, typecheck, and lint.

Commit as:
test(pitches): cover inventory boundaries
```

## Milestone 05 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
