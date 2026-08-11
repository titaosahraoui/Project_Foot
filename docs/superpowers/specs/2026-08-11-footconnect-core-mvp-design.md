# FootConnect Core MVP Redesign

**Status:** Approved design
**Date:** 2026-08-11
**Pilot market:** Algiers, Algeria

## Purpose

FootConnect is competitive amateur football infrastructure. Its first product is not a general football social network. It helps local teams repeatedly complete this loop:

> Create a team → publish availability → find a suitable opponent → agree to play → reserve a pitch → play → verify the result → update Elo and reputation → play again.

Pitch owners participate in a connected business loop:

> List a pitch → publish availability → receive a booking → host a match → record the booking outcome and score → build reliable demand → receive more bookings.

The core MVP succeeds when real teams in Algiers can complete both loops without off-platform coordination for any step except payment.

## Assessment of the Existing Direction

### Decisions to preserve

- Keep the Turborepo and pnpm monorepo.
- Keep the Express and TypeScript modular monolith.
- Keep PostgreSQL and Prisma as the durable source of truth.
- Keep Expo for the player application and Next.js for the pitch-owner dashboard.
- Keep REST endpoints with shared Zod contracts.
- Keep module boundaries enforced through services: modules may use another module's public service but never its repository.
- Keep team Elo as the initial competitive rating; do not introduce individual Elo.
- Keep geo-based discovery and the dedicated pitch-owner product surface.

### Decisions to change

- Replace challenge-only discovery with recommendations followed by captain-controlled challenges.
- Separate agreement to play from selection and reservation of an exact pitch slot.
- Make team match availability a first-class domain object.
- Replace one-captain result entry with independent three-party score submissions.
- Update Elo only after a result reaches a verified consensus.
- Add objective team reliability beside Elo to protect pitch owners.
- Move Elo, competitive records, and rating history out of the team aggregate and into a ratings-owned model.
- Make the competitive loop the mobile home experience and defer the social feed.
- Treat Algiers as the explicit pilot boundary rather than launching with thin nationwide supply.

### Existing repository baseline

The repository is beyond Phase 0. It already contains working or partial slices for authentication, profiles, teams, pitches, pitch availability, mobile authentication and team screens, pitch discovery, and the owner dashboard. The implementation roadmap must audit and harden these slices rather than recreate them. Bookings, matchmaking, results, ratings, reputation, and notifications remain incomplete or stubbed.

## Goals

- Enable captains to create and manage a recognizable competitive team.
- Let teams publish when, where, and in which format they want to play.
- Recommend eligible local opponents using simple and explainable ranking.
- Let captains agree to play before introducing pitch inventory.
- Let the challenging captain organize an exact pitch booking after acceptance.
- Protect pitch inventory against overlapping bookings.
- Give pitch owners objective information about team booking reliability.
- Verify match scores through two captains and the pitch owner.
- Update team Elo and competitive records exactly once per verified match.
- Give player and owner applications complete, recoverable lifecycle experiences.

## Explicit Non-goals

- Social feed, follows, posts, comments, and reactions
- General-purpose chat
- Online payments, deposits, commissions, or Stripe integration
- Individual Elo or inferred player skill
- Goals, assists, cards, Player of the Match, or other player performance claims
- Sportsmanship stars, written reviews, or subjective reputation
- Automatic opponent assignment
- Tournaments, leagues, seasons, or seasonal card tiers
- Dynamic pitch pricing
- Owner employees, staff permissions, invoices, or advanced CRM
- Multi-city launch optimization
- Full Arabic or French localization during the initial pilot

## Pilot Constraints and Defaults

- The pilot market is Algiers.
- User-facing distance is expressed in kilometers.
- User-facing prices use DZD. Monetary records include an explicit currency code and an integer minor-unit amount.
- Durable timestamps are stored in UTC and rendered using `Africa/Algiers`.
- New teams start at 1000 Elo.
- The default opponent search radius is 10 km.
- The default preferred Elo tolerance is ±150.
- Initial supported formats are 5v5, 7v7, and 11v11.
- Availability must begin at least six hours in the future.
- A challenge response is due at the earlier of 24 hours after creation or four hours before the proposed window starts.
- The organizer must request a booking by the earlier of 24 hours after acceptance or two hours before the proposed window starts.
- A pitch owner must respond to a booking request by the earlier of 12 hours after creation or one hour before the requested start.
- Score submissions are due 48 hours after the scheduled match ends.
- A cancellation within six hours of the scheduled start is late.
- Product thresholds are named domain configuration values so operators can adjust them without changing lifecycle code.

## Roles and Authority

### Player

- Manages their profile and FootConnect player card.
- Joins teams and appears in lineups.
- Cannot challenge, book, submit team scores, or manage team availability unless they are the active captain.

### Captain

- Manages the roster, formation, starting lineup, and team availability.
- Sends and responds to challenges.
- If they send the challenge, becomes the match organizer.
- Submits the team's independent result and responds to booking-outcome disputes.
- A team has one active captain in the core MVP. Captain transfer is required before the active captain can leave.

### Pitch owner

- Manages only pitches they own.
- Publishes recurring availability and DZD pricing.
- Confirms or declines booking requests.
- Records the booking outcome and an independent match score.
- Cannot alter captain submissions or directly update Elo.

### Admin

- Resolves disputed booking outcomes and match results.
- Must provide a resolution reason.
- Cannot silently rewrite original submissions or reports; all administrative actions are audited.

## Modular Monolith Boundaries

| Module | Owns |
|---|---|
| `auth` | Registration, login, refresh sessions, and authorization primitives |
| `users` | Player profiles and account roles |
| `teams` | Teams, memberships, captaincy, player cards, formations, and lineups |
| `pitches` | Venues, facilities, pricing, and recurring availability rules |
| `matchmaking` | Team availability, opponent recommendations, and challenges |
| `bookings` | Exact reservations, collision prevention, offline payment state, booking outcomes, and reliability projections |
| `matches` | Scheduled matches, participant snapshots, score submissions, consensus, and result disputes |
| `ratings` | Team Elo, competitive records, rating history, and leaderboards |
| `notifications` | In-app events, push delivery, deadlines, and reminders |
| `admin` | Audited booking-outcome and match-result resolution workflows |

Every module keeps the established route → controller → service → repository structure. Shared request and response contracts live in `@footconnect/shared`. A module may call another module's public service but may not import its repository or access its tables through a different repository.

Cross-module operations use a shared transaction context while preserving repository ownership. The following transitions must be atomic:

- Confirm a booking and create its scheduled match.
- Verify a result and apply both team rating changes.
- Finalize a team-fault booking outcome and update the reliability projection.

All transition commands accept or derive an idempotency key. Retrying a command cannot create a second match, rating update, notification event, or reputation penalty.

## Core Domain Model

### Team and identity

- `Team`: identity, logo, home location, preferred formats, and active captain.
- `TeamMembership`: active or historical membership and team role.
- `PlayerCard`: player photo, display name, primary position, and visual identity metadata.
- `TeamFormation`: the team's selected supported formation for a match format.
- `TeamLineup`: ordered player positions for the current team display.
- `MatchLineupSnapshot`: immutable participating players and formation recorded for a scheduled match.

Player cards display profile information, verified appearances, and the team's competitive record. They do not display unverified goals, assists, Player of the Match, or individual Elo.

### Matchmaking

- `TeamAvailability`: team, creator, time window, format, origin, radius, preferred Elo tolerance, message, and lifecycle status.
- `MatchChallenge`: challenger, challenged team, both referenced availability records, organizer, snapshotted accepted conditions, response deadline, booking deadline, and status.

Availability states are `OPEN`, `MATCHED`, `CANCELLED`, and `EXPIRED`.

Challenge states are `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, and `EXPIRED`. Acceptance means the teams agreed to play within the stored conditions. It does not reserve a pitch or create a match.

### Pitch inventory and booking

- `Pitch`: owner, location, supported format, amenities, active state, and base price.
- `PitchAvailabilityRule`: recurring local-time windows from which discoverable inventory is calculated.
- `PitchBlock`: owner-created closure or maintenance period.
- `Booking`: exact UTC start/end, agreed price and currency, organizer, team, challenge, status, and owner response deadline.
- `BookingOutcomeReport`: owner's post-booking report and the overall booking disposition.
- `BookingTeamOutcome`: one outcome for each participating team, its captain response, dispute state, and administrative resolution.
- `TeamReliability`: bookings-derived projection used for efficient team discovery and display.

Booking states are `PENDING_OWNER_CONFIRMATION`, `CONFIRMED`, `DECLINED`, `CANCELLED_BY_TEAM`, `CANCELLED_BY_OWNER`, and `EXPIRED`.

Offline payment states are `UNPAID`, `PAID_AT_VENUE`, and `WAIVED`. FootConnect does not move money in the core MVP.

### Match and result

- `Match`: teams, confirmed booking, scheduled window, designated captain snapshots, and match state.
- `MatchResultSubmission`: one hidden, immutable score submission from each designated captain and the pitch owner.
- `MatchResult`: verified or administratively resolved score and verification method.
- `MatchResultDispute`: disputing party, reason, state, and administrative resolution audit.

Match states are `SCHEDULED`, `AWAITING_RESULTS`, `CONSENSUS_PENDING`, `VERIFIED`, `DISPUTED`, `CANCELLED`, and `NO_SHOW`.

### Ratings

- `TeamRating`: current Elo, matches played, wins, draws, and losses.
- `RatingHistory`: team, opponent, match, rating before, expected score, actual score, change, rating after, and timestamp.

There is one rating history row per participating team and verified match. A unique match-and-team constraint prevents duplicate rating application.

## Opponent Recommendation Design

Recommendation is assistive; FootConnect never forces two teams into a match.

An opponent is eligible when:

- The team is different from the searching team.
- Both teams are active and have an active captain.
- Their open availability windows overlap.
- Their requested match formats match.
- The distance is within both teams' accepted radius.
- They are not already committed through the same availability window.

Eligible teams are ranked from 0 to 100 using:

- 65% Elo similarity
- 35% distance proximity

The Elo component is `1 - min(Elo difference / mutual Elo tolerance, 1)`. The distance component is `1 - min(distance / mutual radius, 1)`. The final score is the rounded weighted sum multiplied by 100. Format and availability are hard eligibility rules rather than score padding. The result includes an explanation showing Elo difference, distance, format, time overlap, and the opponent's reliability label. Recent-opponent variety and reliability weighting are deferred until pilot data demonstrates a need.

## Matchmaking and Booking Lifecycle

1. A captain publishes team availability.
2. FootConnect returns eligible recommended opponents.
3. The captain sends a challenge referencing the accepted play conditions.
4. The other captain accepts, declines, or lets the challenge expire.
5. On acceptance, the challenging captain becomes the organizer.
6. The organizer selects an exact available pitch and time compatible with the accepted conditions.
7. Booking creation rechecks all constraints and conflicts transactionally.
8. A pending booking blocks conflicting booking confirmations until it is declined, cancelled, or expires. This is a real booking request, not a pre-checkout slot hold.
9. The pitch owner confirms or declines the request.
10. A decline returns the organizer to pitch selection while the accepted challenge remains valid.
11. Confirmation atomically creates one scheduled match and participant snapshots.
12. If the booking deadline expires first, no match is created and the challenge can no longer be booked.

PostgreSQL enforces non-overlapping blocking booking ranges for each pitch. Application checks provide friendly errors, while the database constraint remains the final concurrency guard.

## Booking Outcome and Reputation

Within 24 hours after the scheduled end, the owner reports an overall booking disposition and a separate outcome for each participating team. Team outcomes use:

- `COMPLETED`
- `NO_SHOW`
- `LATE_CANCELLATION`
- `EXCLUDED_OWNER_CANCELLATION`

If the owner cancelled the booking, both teams receive `EXCLUDED_OWNER_CANCELLATION`. Otherwise, each team is assessed independently: a team that appeared and honored the booking receives `COMPLETED`, even if its opponent did not appear. This prevents the reliable team from being penalized for its opponent.

Each team outcome remains pending during a 24-hour captain response window. The captain can accept their team's outcome or open a dispute with a reason. An undisputed outcome finalizes when its response window expires. A disputed outcome does not affect that team's reputation until an admin resolves it.

Only resolved team-caused outcomes affect reliability. Owner cancellations are excluded. Reliability is transparent:

- A completed booking contributes 1 reliability point.
- A late cancellation contributes 0.25 reliability points.
- A no-show contributes 0 reliability points.
- Reliability percentage is earned points divided by resolved team-responsible bookings, multiplied by 100.
- Fewer than three resolved team-responsible bookings display `NEW` instead of a percentage.
- The UI always shows completed bookings, late cancellations, and no-shows beside the label.

Original reports, captain responses, and admin decisions remain immutable audit records.

## Three-party Result Consensus

The designated captains of both teams and the pitch owner independently submit the final home and away score. Existing submissions remain hidden from parties who have not submitted. Each role may submit once; correction requires an audited admin workflow.

Consensus behaves as follows:

1. Three identical submissions verify immediately as `UNANIMOUS`.
2. Two identical submissions and one different submission create `MAJORITY_PENDING`. All parties are notified, and the dissenting party receives a 24-hour dispute window. Without a dispute, the majority score verifies as `MAJORITY`.
3. Three different submissions create `DISPUTED` immediately.
4. If the owner misses the submission deadline but both captains agree, their score verifies as `CAPTAINS_AGREED`.
5. If one party is missing and the two submitted scores agree, the system waits for the submission deadline and then starts the same 24-hour provisional-majority window.
6. Fewer than two agreeing submissions enter admin review after the submission deadline.

Score submissions may be collected before booking outcomes finalize, but a result cannot verify while a resolved team outcome says `NO_SHOW`, `LATE_CANCELLATION`, or `EXCLUDED_OWNER_CANCELLATION`. A score consensus that conflicts with the booking outcome becomes an admin dispute. This prevents Elo from changing for a match that the reliability workflow says was not played.

Admin resolution records the selected score, reason, resolver, and timestamp. It never deletes or replaces original submissions. Elo remains unchanged while a result is awaiting submissions, provisional, or disputed.

## Elo Design

The initial Elo implementation uses the standard two-team formula:

- Initial rating: 1000
- K-factor: 32
- Expected score: `1 / (1 + 10 ^ ((opponentRating - teamRating) / 400))`
- Actual score: 1 for a win, 0.5 for a draw, and 0 for a loss
- Rating change: rounded `K × (actualScore - expectedScore)`

Both rating changes are calculated from the pre-match ratings and applied in one transaction. The sum is zero except for integer-rounding correction, which is applied symmetrically. Reprocessing the same result returns the existing history without changing either rating.

Only verified results update matches played, wins, draws, losses, Elo, rating history, and leaderboard positions. Cancelled and no-show matches do not affect Elo in the core MVP.

## Product Experiences

### Player mobile application

The primary tabs are Home, Teams, Play, Notifications, and Profile.

- Home shows the active team, Elo, Algiers leaderboard position, reliability, next match, pending actions, and recommended opponents.
- Teams shows the roster, FootConnect player cards, captain controls, formation, lineup, rating history, and team reliability.
- Play lets captains publish availability, review recommendations, manage challenges, choose a pitch after acceptance, and follow booking state.
- Notifications exposes challenge, booking, outcome, score, dispute, and Elo events with direct links to the required action.
- Profile manages player identity and card information.

### Pitch-owner web dashboard

- Today's pitch schedule and pending actions
- Pitch and recurring-availability management
- Booking confirmation and decline
- Booking outcome entry
- Independent score submission
- Booking-outcome disputes and resolution status
- Basic booking, occupancy, cancellation, and no-show counts

### Admin web surface

The MVP admin surface is deliberately narrow: queues for disputed booking outcomes and match results, evidence and audit history, resolution input, and immutable decision records.

## Notifications and Deadlines

Domain state remains in PostgreSQL. Redis and BullMQ may deliver expiration, deadline, reminder, and notification jobs. Every job re-reads current database state before acting and is safe to retry.

Required notification events include:

- Challenge received, accepted, declined, cancelled, and expired
- Organizer booking deadline approaching
- Booking requested, confirmed, declined, cancelled, and expired
- Upcoming match reminder
- Booking outcome reported, accepted, disputed, and resolved
- Score submission requested and deadline approaching
- Majority consensus awaiting dispute
- Result disputed and resolved
- Elo and leaderboard update completed

Loss or delay of a notification cannot change the underlying lifecycle outcome.

## Error Handling and Recovery

- Validation failures return field-level errors defined by shared Zod contracts.
- Authorization failures distinguish unauthenticated, wrong role, and wrong resource ownership.
- Stale lifecycle commands return the current resource state rather than applying an invalid transition.
- Pitch conflicts return a conflict response containing refreshed compatible alternatives.
- Idempotent retries return the previously created resource or transition result.
- Failed background jobs retry with bounded backoff and retain a dead-letter record for operator inspection.
- Cross-module transaction failures roll back all state changes.
- Mobile and web action screens show a recoverable state and a direct retry or refresh action.

## Security, Privacy, and Audit

- Captains can act only for teams they currently captain.
- Pitch owners can act only on their pitches and associated bookings or matches.
- Admin-only resolution endpoints require an admin role and a human-readable reason.
- Result submissions are hidden until the viewer has submitted or the consensus window has closed.
- Public discovery exposes approximate area and calculated distance, not another user's private coordinates.
- Rate limits protect authentication, challenges, booking requests, score submissions, and disputes.
- Audit records cover role changes, captain transfers, booking outcomes, result submissions, resolutions, rating application, and reliability changes.

## Testing Strategy

### Unit tests

- Recommendation eligibility and score calculation
- Lifecycle transition tables
- Booking compatibility and late-cancellation classification
- Reliability calculation and `NEW` threshold
- Three-party consensus cases
- Elo win, draw, upset, rounding, and idempotency cases

### Integration tests against PostgreSQL

- Authorization and ownership for every mutation
- Overlapping booking attempts under concurrency
- Booking confirmation and match creation atomicity
- Outcome dispute and reliability update atomicity
- Result verification and two-team rating update atomicity
- Unique constraints preventing duplicate submissions and rating histories
- Job retries against already-transitioned records

### End-to-end tests

- Create teams → publish availability → discover → challenge → accept → book → owner confirm → play → three parties submit → verify → update Elo
- Booking conflict followed by successful alternative selection
- Owner-declined booking followed by a different confirmed pitch
- Team no-show report, captain dispute, admin resolution, and reliability update
- Majority score, dissenting-party dispute, admin resolution, and one Elo update
- Missing owner score with matching captain scores

## Observability

- Structured logs include request ID, actor ID, team ID, booking ID, match ID, and transition name where applicable.
- Metrics cover challenge conversion, time to booking, booking confirmation, booking conflicts, completion, no-shows, result verification method, dispute rate, and Elo application failures.
- Health checks report API, PostgreSQL, Redis, and worker status separately.
- Audit and idempotency records make every competitive or reputation change explainable.

## Layered Delivery Roadmap

1. Audit the repository baseline and align architecture documentation.
2. Establish shared domain states, contracts, database structures, transaction support, and audit conventions.
3. Harden existing authentication and player profiles.
4. Harden teams and add player cards, formations, lineups, and captain transfer.
5. Harden pitches, recurring availability, exact inventory discovery, owner calendar, and conflicts.
6. Add team match availability and opponent recommendations.
7. Add the complete challenge lifecycle.
8. Add organizer-owned booking after challenge acceptance.
9. Add match scheduling, participant snapshots, and pre-match lineups.
10. Add booking outcomes, disputes, and team reliability.
11. Add three-party result submission, consensus, and admin resolution.
12. Add Elo, rating history, competitive records, and leaderboards.
13. Integrate mobile, owner, admin, notification, and recovery experiences.
14. Verify the entire core loop and prepare the Algiers pilot.

Each milestone receives a layered prompt pack: a milestone context prompt followed by independently testable prompts for contracts, persistence, domain logic, API, client integration, tests, and documentation. A prompt must identify dependencies, exact scope, exclusions, files to inspect, required tests, verification commands, and completion criteria.

## MVP Acceptance

The core MVP is ready for the Algiers pilot when:

- A captain can create a team with a valid roster and lineup.
- Two eligible teams can discover each other through overlapping availability.
- They can agree to play without reserving a pitch prematurely.
- The organizer can obtain a conflict-free owner-confirmed pitch booking.
- The owner can record a booking outcome and independently submit the score.
- Both captains can submit hidden scores.
- Consensus or an audited admin decision produces one verified result.
- One atomic and idempotent operation updates Elo and rating history for both teams.
- Team reliability reflects only resolved team-responsible booking outcomes.
- The mobile, owner, and admin surfaces expose every required action and recovery path.
- Automated tests cover the successful loop, concurrency, missed deadlines, disputes, retries, and authorization failures.
