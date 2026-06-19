# FootConnect ⚽

A "FIFA in real life" platform for amateur football: players build teams, challenge other teams to matches, reserve pitches, and connect through an integrated social layer. Pitch owners manage their pitches and reservations from a web dashboard.

## Stack

- **Monorepo:** Turborepo + pnpm
- **Backend (`apps/api`):** structured Express + TypeScript (modular monolith), Prisma, PostgreSQL, Redis
- **Web dashboard (`apps/web`):** Next.js + TypeScript (pitch owners)
- **Mobile app (`apps/mobile`):** React Native + Expo (players)
- **Shared (`packages/*`):** Zod schemas/types, typed API client, config, UI tokens

See [`docs/architecture.md`](docs/architecture.md) for the full architecture and roadmap.

## Prerequisites

- Node.js >= 22
- pnpm >= 11
- Docker (for Postgres + Redis)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env

# 3. Start Postgres + Redis
pnpm docker:up

# 4. Run the database migration
pnpm --filter @footconnect/api prisma:migrate

# 5. Start everything (or filter to one app)
pnpm dev
# pnpm --filter @footconnect/api dev
# pnpm --filter @footconnect/web dev
# pnpm --filter @footconnect/mobile start
```

API health check: `GET http://localhost:4000/health`

## Monorepo layout

```
apps/
  api/      Express backend (modular monolith)
  web/      Next.js pitch-owner dashboard
  mobile/   Expo React Native player app
packages/
  shared/      Zod schemas + shared types
  api-client/  Typed REST client
  ui/          Design tokens
  config/      tsconfig / eslint / prettier presets
infra/
  docker-compose.yml
```

## Roadmap

Phase 0 (foundation) → Auth → Teams → Pitches/Dashboard → Reservations → Matchmaking → Results → Social → Payments. See [`docs/architecture.md`](docs/architecture.md).
