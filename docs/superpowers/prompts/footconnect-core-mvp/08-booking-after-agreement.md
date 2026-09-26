# Milestone 08 — Booking After Agreement

**Outcome:** The organizer requests one compatible exact pitch booking; owner confirmation atomically creates one scheduled match.

## M08-T01 — Define booking contracts and persistence

```text
Implement only M08-T01 with schema/migration tests first.

Create packages/shared/src/booking.ts and export it. Replace the bookings stub with standard
module files. Modify schema.prisma and create migration add_bookings.

Booking fields: pitchId, challengeId unique, organizerUserId, challengerTeamId, opponentTeamId,
startAt/endAt UTC, priceAmountMinor, currency DZD, BookingStatus, OfflinePaymentStatus, owner
response deadline, confirmedAt, declinedAt, cancelledAt, expiresAt, createdAt, updatedAt. Store
the agreed price snapshot. Define create/detail/list/decision/cancel schemas.

A challenge may have multiple sequential declined/expired Booking rows. Do not make challengeId
globally unique. Add a PostgreSQL partial unique index on challengeId for statuses
PENDING_OWNER_CONFIRMATION and CONFIRMED so only one blocking attempt exists while historical
declined/expired attempts remain queryable.

Commit as:
feat(bookings): add booking persistence
```

## M08-T02 — Validate booking compatibility

```text
Implement only M08-T02 with pure unit tests first.

Create booking-compatibility.ts and tests. Export assertBookingCompatible(input) checking:
- challenge is ACCEPTED and before bookingDeadline;
- actor is organizer and still active challenger captain;
- requested start/end are inside the accepted window;
- duration is 30–180 minutes;
- pitch is active and format exactly matches;
- pitch distance from accepted origin is within accepted radius;
- requested time is produced by pitch inventory and not blocked;

Return 422 CONDITIONS_VIOLATION for agreement mismatch, 409 STATE_CONFLICT for stale challenge,
and 409 INVENTORY_CONFLICT for unavailable inventory. Test every boundary with a fixed clock.

Commit as:
feat(bookings): validate accepted conditions
```

## M08-T03 — Add PostgreSQL booking collision protection

```text
Implement only M08-T03 with concurrent integration tests first.

Create migration add_booking_exclusion_constraint using PostgreSQL btree_gist and an exclusion
constraint on pitchId with tstzrange(startAt, endAt, '[)'). Apply it only to
PENDING_OWNER_CONFIRMATION and CONFIRMED rows. Adjacent bookings may coexist; any positive overlap
must fail. Map the Prisma/database violation to 409 INVENTORY_CONFLICT.

Update pitches inventory service to subtract blocking booking ranges through bookings.service;
pitches must not import bookings.repository. Add query batching so one inventory request performs
one blocking-range lookup.

Tests fire two simultaneous requests for the same slot and prove one success, one conflict, no
duplicate blocking booking, and availability restored after decline/expiry.

Commit as:
feat(bookings): prevent overlapping pitch bookings
```

## M08-T04 — Create idempotent booking requests

```text
Implement only M08-T04 with integration tests first.

Implement createBooking(actorId, input, idempotencyKey, now). Load accepted challenge through
matchmaking.service and exact inventory through pitches.service. Apply compatibility, calculate
owner deadline, snapshot price, and create PENDING_OWNER_CONFIRMATION. The same actor/scope/key and
request returns the same booking. A changed request with the same key returns 409. Declined or
expired attempts permit a new key/new slot while the challenge booking deadline remains active.

Integration tests cover organizer/member/opponent captain, deadline, retry, changed payload,
price snapshot, and second attempt after decline.

Commit as:
feat(bookings): create organizer booking requests
```

## M08-T05 — Add scheduled-match foundation

```text
Implement only M08-T05 with migration and service tests first.

Create packages/shared/src/match.ts with scheduled match summary types. Replace the matches stub
with standard module files. Add Match with bookingId unique, homeTeamId, awayTeamId, homeCaptainId,
awayCaptainId, pitchOwnerId, startAt/endAt, MatchFormat, MatchStatus default SCHEDULED, createdAt,
and updatedAt. Add MatchParticipant rows for both teams.

Export matches.service.scheduleFromConfirmedBooking(input, tx) and getMatchByBookingId. The
schedule command is idempotent by bookingId and snapshots active captain IDs. It accepts the
shared transaction context and its repository uses only matches-owned tables.

Tests prove one match, two participants, captain snapshots, and idempotent retry.

Commit as:
feat(matches): add scheduled match foundation
```

## M08-T06 — Implement owner decisions and atomic confirmation

```text
Implement only M08-T06 with integration tests first.

Implement bookings.service.confirmBooking(ownerId, bookingId, now) and declineBooking. Only the
owning PITCH_OWNER acts before response deadline. Confirmation uses withTransaction to change the
booking to CONFIRMED and call matches.service.scheduleFromConfirmedBooking in the same transaction.
Any match failure rolls back confirmation. Decline releases inventory and leaves the challenge
ACCEPTED until its booking deadline. Repeated same decision is idempotent; opposite/stale decision
returns 409 STATE_CONFLICT.

Also implement cancellation and expiry. Before confirmation, only the organizer cancels. After
confirmation and before match end, either designated captain may cancel for their team, recording
responsibleTeamId and cancelledAt, while the pitch owner may cancel as owner. In the same transaction,
set Booking to CANCELLED_BY_TEAM or CANCELLED_BY_OWNER, set Match CANCELLED, and release inventory.
A team cancellation within six hours is marked late for Milestone 10; an earlier cancellation has no
reputation effect. Repeated same cancellation is idempotent; a different actor/reason after
cancellation conflicts. Tests cover rollback, ownership, deadlines, retry, release, organizer/opponent
captain identity, owner cancellation, early/late classification, and match cancellation.

Commit as:
feat(bookings): confirm booking and schedule match
```

## M08-T07 — Expose booking API and client flows

```text
Implement only M08-T07 with integration tests first.

Routes:
- POST /api/v1/bookings
- GET /api/v1/bookings/mine
- GET /api/v1/bookings/owner
- GET /api/v1/bookings/:id
- POST /api/v1/bookings/:id/confirm
- POST /api/v1/bookings/:id/decline
- POST /api/v1/bookings/:id/cancel

Add ApiClient methods. Booking detail exposes accepted-condition comparison, pitch public summary,
teams, deadlines, price, payment state, status, matchId after confirmation, and viewer actions.
Require Idempotency-Key for create/decision commands. Add pagination and ownership tests.

Commit as:
feat(bookings): expose booking workflow
```

## M08-T08 — Build organizer and owner booking UI

```text
Implement only M08-T08.

Mobile: enable Choose a pitch for the organizer after challenge acceptance. Filter exact pitch
inventory to accepted conditions, show comparison and DZD price, confirm intent, create with a
stable idempotency key, and track owner response. Handle inventory conflict by refreshing and
offering alternatives.

Web: add pending-booking queue and detail to the owner dashboard with confirm/decline, deadlines,
teams, pitch/time, and DZD price. Require confirmation for destructive decline.

Read Expo/Next docs. Run mobile/web typecheck and web build. Manually test conflict recovery,
double submit, owner decline then alternative booking, owner confirm, and forbidden users.

Commit as:
feat(booking-ui): connect organizer and owner workflow
```

## Milestone 08 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
