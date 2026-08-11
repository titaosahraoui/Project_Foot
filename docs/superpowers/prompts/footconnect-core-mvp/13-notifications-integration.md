# Milestone 13 — Notifications and Integrated Experiences

**Outcome:** Durable action notifications, retry-safe deadline jobs, and cohesive mobile/owner/admin queues connect every lifecycle step.

## M13-T01 — Add durable in-app notifications

```text
Implement only M13-T01 with schema/migration and integration tests first.

Create notification.ts shared contracts. Replace notification stubs with standard module files.
Add Notification with recipientUserId, type, title, body, resourceType, resourceId, eventKey,
readAt, createdAt, and unique recipientUserId+eventKey. Add indexes for recipient+readAt+createdAt.

Expose GET /api/v1/notifications with unread filter/pagination and POST
/api/v1/notifications/:id/read plus POST /read-all. Only the recipient can read/update. Creating
the same event twice returns the existing notification. Add ApiClient methods and tests for order,
pagination, ownership, repeated event, single read, and read-all.

Commit as:
feat(notifications): add durable action notifications
```

## M13-T02 — Add BullMQ worker infrastructure

```text
Implement only M13-T02 with unit tests first.

Files:
- Modify apps/api/package.json and pnpm-lock.yaml to add BullMQ.
- Create apps/api/src/lib/queue.ts and queue.test.ts.
- Create apps/api/src/worker.ts and apps/api/src/workers/lifecycle.worker.ts.
- Modify apps/api/src/config/env.ts and .env.example.

Define one `lifecycle` queue with named jobs challenge-expiry, availability-expiry, booking-expiry,
outcome-finalization, result-deadline, consensus-finalization, match-reminder, and notification-
delivery. Job IDs are deterministic `<name>:<resourceId>:<deadlineIso>`. Use bounded exponential
backoff and retained failed jobs. Worker handlers re-read PostgreSQL and call public services; they
never mutate repositories directly. Add worker dev/start scripts and graceful shutdown.

Unit tests mock queue/worker and prove deterministic IDs, retry options, and handler routing.

Commit as:
feat(workers): add lifecycle job infrastructure
```

## M13-T03 — Schedule and process lifecycle deadlines

```text
Implement only M13-T03 with fixed-clock unit/integration tests first.

At successful creation/transitions, enqueue exact deadline jobs for availability, challenge,
booking, booking-team-outcome, result submission, and consensus window. Each handler calls the
existing expire/finalize/process public service and is safe when state already changed. Add a
startup reconciliation function that queries due/incomplete deadlines through each public service
and re-enqueues missing jobs; do not scan another module's tables from the worker.

Tests simulate duplicate/delayed/out-of-order jobs and prove final state and side effects occur once.

Commit as:
feat(workers): automate lifecycle deadlines
```

## M13-T04 — Emit lifecycle notifications

```text
Implement only M13-T04 with integration tests first.

Create notification events after committed domain transitions for challenge received/accepted/
declined/cancelled/expired; booking requested/confirmed/declined/cancelled/expired; match reminder;
outcome reported/accepted/disputed/resolved; score requested/submitted; majority pending; result
disputed/resolved; and Elo applied. Use deterministic event keys including transition and resource.

Resolve recipients through owning public services or IDs already in transition results. Add
NotificationOutbox with eventKey primary key, eventType, payload Json, occurredAt, processedAt,
attemptCount, lastError, and nextAttemptAt. Insert the outbox row in the domain transaction. A worker
claims unprocessed rows, creates recipient notifications with their unique event keys, and marks the
row processed only after every recipient succeeds. Failed attempts increment count and set bounded
backoff. Never send inside a transaction that may roll back.

Tests prove rollback emits nothing, retries create one notification, and each role receives only its
required action.

Commit as:
feat(notifications): connect domain lifecycle events
```

## M13-T05 — Build the mobile notification center

```text
Implement only M13-T05.

Modify mobile navigation/App to use Home, Teams, Play, Notifications, Profile. Create
NotificationsScreen and NotificationRow. Show unread count, chronological list, pull-to-refresh,
read/read-all, and deep links to challenge, booking, match, outcome, result, or rating views. Mark
read only after the destination navigation succeeds. Unknown/deleted resources show a safe expired
state. Use polling while foregrounded; push transport is not required for the core MVP.

Read Expo docs. Run mobile typecheck and manually verify badge, deep links, deleted resource,
offline refresh, and large text.

Commit as:
feat(mobile): add action notification center
```

## M13-T06 — Build owner and admin action queues

```text
Implement only M13-T06.

Refactor the web home into an authenticated owner dashboard with Today's Schedule, Pending Booking
Requests, Outcome Reports Due, Score Submissions Due, and Active Disputes. ADMIN users receive links
to booking-outcome and result-dispute queues. Each card uses existing API endpoints and displays
deadlines in Africa/Algiers. Provide empty/loading/error/retry states and accessible headings.

Read local Next.js docs. Add GET /api/v1/bookings/owner/actions for booking/outcome/score items exposed
through bookings public services, and use the existing admin dispute-list endpoints for admin queues.
Return all required rows with batched relations. Run web typecheck/build and manually verify owner
with zero, one, and many pitches.

Commit as:
feat(web): add owner and admin action queues
```

## M13-T07 — Integrate and regression-test the product journey

```text
Implement only M13-T07.

Review mobile Home/Teams/Play/Notifications/Profile and owner/admin navigation as one journey.
Remove obsolete Phase labels and stub challenge UI. Ensure every backend viewerAction has a reachable
screen and every screen handles stale state by refreshing rather than applying an invalid command.
Add integration tests proving key notification links reference resources visible to the recipient.
Add client typecheck/build gates and a documented manual journey checklist under docs/qa/.

Do not add social tabs, chat, payment actions, or push notification transport.

Commit as:
feat(apps): integrate competitive core journey
```

## Milestone 13 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm --filter @footconnect/web build
pnpm --filter @footconnect/mobile typecheck
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
