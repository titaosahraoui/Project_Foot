# AGENTS.md — FootConnect

Orientation for Codex working in this repository.

## What this is

FootConnect is a "FIFA in real life" platform for amateur football:

- **Players** (mobile app) register, build a profile, create/join **teams**, **challenge** other teams to matches, **reserve pitches**, and use a **social** layer (feed, follows, chat).
- **Pitch owners** (web dashboard) list pitches, set availability/pricing, and manage reservations.

Full architecture & phased roadmap: [`docs/architecture.md`](docs/architecture.md).

## Stack

- Monorepo: **Turborepo + pnpm** (`pnpm-workspace.yaml`, `turbo.json`)
- Backend `apps/api`: **structured Express + TypeScript** (modular monolith), **Prisma**, **PostgreSQL**, **Redis**
- Web `apps/web`: **Next.js + TypeScript** (pitch-owner dashboard)
- Mobile `apps/mobile`: **React Native + Expo** (player app)
- Shared `packages/*`: `@footconnect/shared` (Zod + types), `@footconnect/api-client`, `@footconnect/ui`, `@footconnect/config`

## Layout

```
apps/api      Express modular monolith
apps/web      Next.js dashboard
apps/mobile   Expo RN app
packages/shared      Zod schemas + inferred types (single source of truth)
packages/api-client  typed REST client (used by web + mobile)
packages/ui          design tokens
packages/config      tsconfig / eslint / prettier presets
infra/docker-compose.yml   Postgres + Redis
```

## Core architecture rule (modular monolith)

The backend is ONE deployable, split into modules under `apps/api/src/modules/<name>/`, each with the same shape:

```
modules/<name>/
  <name>.routes.ts       Express router (mounted in src/app.ts)
  <name>.controller.ts   request/response handling
  <name>.service.ts      business logic (the module's public surface)
  <name>.repository.ts   Prisma data access (private to the module)
  <name>.schemas.ts      Zod schemas (or re-export from @footconnect/shared)
```

**The one discipline that matters:** a module may import another module's `*.service.ts`, but **never** another module's `*.repository.ts` or Prisma models directly. This keeps boundaries clean and lets a module (e.g. `matches`) be extracted into its own service later without rework.

Bounded contexts: `auth`, `users`, `teams`, `pitches`, `bookings`, `matches` (challenges + results), `social`, `notifications`.

## Validation

Zod schemas in `@footconnect/shared` are the single source of truth — imported by the API (request validation) and by web/mobile (forms/clients). Don't duplicate shapes; add them to `shared`.

## Running things

```bash
pnpm install                                   # install all workspaces
cp .env.example .env                            # configure env
pnpm docker:up                                  # Postgres + Redis
pnpm --filter @footconnect/api prisma:migrate   # run migrations
pnpm dev                                        # run all apps via turbo
pnpm --filter @footconnect/api dev              # just the API
pnpm --filter @footconnect/web dev              # just the dashboard
pnpm --filter @footconnect/mobile start         # just the mobile app
pnpm typecheck && pnpm lint                     # checks across the repo
```

API health: `GET http://localhost:4000/health` (reports DB + Redis connectivity).

## Conventions

- Package scope is `@footconnect/*`; internal deps use `workspace:*`.
- TypeScript everywhere; shared tsconfig in `@footconnect/config`.
- Each phase of the roadmap gets its own spec before implementation — don't build ahead of the current phase without a spec.

## Status

Phase 0 (foundation/scaffold) is the current milestone. Subsequent phases: Auth → Teams → Pitches/Dashboard → Reservations → Matchmaking → Results → Social → Payments.
