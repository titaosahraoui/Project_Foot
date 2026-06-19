# FootConnect — Architecture & Roadmap

## Overview

FootConnect is a "FIFA in real life" platform for amateur football: players register, build profiles, create or join **teams**, **discover and challenge** other teams to matches, and **reserve pitches** to play on — with an integrated **social network** layer. Pitch **owners** use a separate web dashboard to list pitches, set availability/pricing, and manage incoming reservations.

### Locked decisions

- **Backend architecture:** modular monolith (not microservices) — extract a service only when a single module genuinely needs independent scale.
- **Backend framework:** structured **Express + TypeScript** — boundaries enforced by a per-module folder convention rather than a framework. (NestJS was the considered alternative.)
- **Matchmaking:** challenge-based (teams discover each other and send direct match challenges; no auto-match algorithm).
- **Builder context:** solo developer, also learning — favor fewer moving parts and strong type-safety.

## Tech stack

| Concern | Choice |
|---|---|
| Monorepo | Turborepo + pnpm |
| Backend | Express + TypeScript (structured/modular monolith) |
| Web (owner dashboard) | Next.js + TypeScript |
| Mobile (players) | React Native via Expo |
| Database | PostgreSQL (+ PostGIS / earthdistance for geo radius search) |
| ORM | Prisma |
| Cache / queues / realtime backbone | Redis (cache, refresh-token store, BullMQ jobs) |
| Realtime | Socket.IO |
| API contract | REST + shared Zod schemas |
| Client data layer | TanStack Query (web + mobile) |
| Auth | JWT access + refresh (argon2 hashing) |
| File storage | S3-compatible (Cloudflare R2 / Supabase Storage) |
| Payments (later) | Stripe |

## Monorepo layout

```
footconnect/
├─ apps/
│  ├─ api/        Express modular monolith
│  ├─ web/        Next.js pitch-owner dashboard
│  └─ mobile/     Expo React Native player app
├─ packages/
│  ├─ shared/     Zod schemas + inferred types (single source of truth)
│  ├─ api-client/ Typed fetch client wrapping the REST API
│  ├─ ui/         Design tokens / primitives
│  └─ config/     tsconfig, eslint, prettier presets
└─ infra/
   └─ docker-compose.yml   Postgres + Redis
```

## Modular-monolith convention

The backend is one deployable, split into modules under `apps/api/src/modules/<name>/`, each with: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts`.

**Boundary rule:** a module may import another module's `service`, but never another module's `repository` or Prisma models directly. This keeps each bounded context isolated and makes future service extraction (e.g. `matches`) cheap.

Bounded contexts: `auth`, `users`, `teams`, `pitches`, `bookings`, `matches` (challenges + results), `social`, `notifications`.

## Domain model

- **User** — identity + player profile (name, avatar, position, skill level, home lat/lng, bio). May also hold PitchOwner / Admin roles.
- **Team** — name, logo, captain, home area (lat/lng), skill rating, win/loss record.
- **TeamMembership** — User ↔ Team with role (captain | member) and status (invited | active | left).
- **Invitation** — pending invite to join a team (or request to join).
- **Pitch** — owned by a PitchOwner: location (lat/lng + address), photos, amenities, size (5/7/11-a-side), price, hours.
- **AvailabilitySlot** — bookable windows for a pitch.
- **Reservation (Booking)** — a team books a pitch slot; status (pending | confirmed | cancelled), price, payment ref.
- **MatchChallenge** — Team A challenges Team B; status (pending | accepted | declined | expired); references the proposed Reservation.
- **Match** — confirmed game born from an accepted challenge; holds score + result after play.
- **Social** — Post, Comment, Reaction, Follow, Conversation/ChatMessage, Notification.

Roles: Player (default), Captain (per-team), PitchOwner, Admin.

## Challenge-based matchmaking

1. A captain **discovers** opponent teams (filter by area radius, skill, match size, availability).
2. Captain sends a **MatchChallenge** proposing a pitch + time.
3. Target captain gets a realtime **notification** and **accepts/declines**.
4. On accept → the proposed **Reservation** is confirmed and a **Match** is created; both teams notified.
5. After play, a captain records the **score**; team/player stats update (feeds leaderboards).

Postgres is the source of truth for challenges; Redis + BullMQ handle fast lookups, expiry, and reminders.

## Cross-cutting concerns

- **Notifications:** in-app + realtime (Socket.IO), mobile push (Expo Push), scheduled jobs (BullMQ).
- **Geo search:** lat/lng on User/Team/Pitch; radius queries via PostGIS / earthdistance.
- **Validation:** Zod schemas in `@footconnect/shared` reused on server and clients.
- **Security:** argon2 hashing, short-lived access + rotating refresh tokens (revocable in Redis), role-based authorization, rate limiting on auth, input validation everywhere.
- **Testing:** unit tests for domain logic; integration tests per module against a real Postgres; e2e for critical flows.
- **Observability:** structured logging (pino), request-id tracing, health endpoints.

## Phased roadmap

- **Phase 0 — Foundation:** monorepo, shared packages, infra (Postgres + Redis), three bootstrapped apps, base Prisma schema + first migration, CI.
- **Phase 1 — Auth & Profiles:** register/login, JWT access+refresh, profile CRUD, wired into web + mobile.
- **Phase 2 — Teams:** create team, invite/accept, roster, captain role, team profile + logo.
- **Phase 3 — Pitches & Owner Dashboard:** owner role, pitch CRUD, availability, Next.js dashboard.
- **Phase 4 — Reservations:** book a pitch slot, owner confirm/cancel, conflict handling.
- **Phase 5 — Matchmaking:** opponent discovery, send/accept/decline challenges, challenge → reservation → match, expiry jobs.
- **Phase 6 — Results & Ratings:** record scores, stats, leaderboards.
- **Phase 7 — Social:** feed, posts, follows, comments/reactions, chat, notification center.
- **Phase 8 — Payments & Polish:** Stripe deposits, push hardening, performance/accessibility/UI polish.

Each phase gets its own spec → plan → implementation cycle.

## Design

The `FootConnect App.dc.html` Claude Design comp drives the mobile UI. It is pulled during UI work via the Claude Design connector / `/design-sync` skill: extract design tokens into `@footconnect/ui` first, build shared RN primitives, then implement screens against real endpoints phase-by-phase.
