# FootConnect

FootConnect is competitive amateur football infrastructure for Algiers. It helps teams create a competitive identity, publish when they can play, receive explainable opponent recommendations, agree on a match through captain-controlled challenges, reserve a pitch, verify the result, and build Elo and booking reliability.

The core loop is:

> Create a team -> publish availability -> find an opponent -> agree to play -> reserve a pitch -> play -> verify the result -> update Elo and reliability -> play again.

Pitch owners use the web dashboard to publish pitch inventory, respond to booking requests, record booking outcomes, and independently submit match scores. Online payment and the general social network are deferred beyond the core MVP.

## Current repository status

The repository already has working but incomplete slices for authentication, profiles, teams, pitches, the player mobile app, and the pitch-owner dashboard. Bookings, matchmaking, verified results, ratings, reputation, and notifications are the main remaining core-MVP work.

See the [baseline audit](docs/baseline-audit-2026-08-11.md) for exact module and client status.

## Product and delivery references

- [Approved core MVP design](docs/superpowers/specs/2026-08-11-footconnect-core-mvp-design.md)
- [Implementation plan](docs/superpowers/plans/2026-08-11-footconnect-core-mvp-implementation.md)
- [Layered prompt-pack index](docs/superpowers/prompts/footconnect-core-mvp/README.md)
- [Architecture and milestone roadmap](docs/architecture.md)

## Stack

- **Monorepo:** Turborepo + pnpm
- **Backend (`apps/api`):** Express + TypeScript modular monolith, Prisma, PostgreSQL, Redis
- **Owner dashboard (`apps/web`):** Next.js + TypeScript
- **Player app (`apps/mobile`):** React Native + Expo
- **Shared packages (`packages/*`):** Zod contracts, typed API client, configuration, and UI tokens

The mobile package currently remains on its checked-in Expo 54, React 19.1, and React Native 0.81 toolchain.

## Prerequisites

- Node.js 22 or newer
- pnpm 11 or newer
- Docker for PostgreSQL and Redis

## Getting started

```bash
# Install dependencies
pnpm install

# Create local configuration
cp .env.example .env

# Start PostgreSQL and Redis
pnpm docker:up

# Apply database migrations
pnpm --filter @footconnect/api prisma:migrate

# Create the three reusable local test accounts
pnpm --filter @footconnect/api prisma:seed

# Start all applications
pnpm dev
```

Useful filtered commands:

```bash
pnpm --filter @footconnect/api dev
pnpm --filter @footconnect/web dev
pnpm --filter @footconnect/mobile start
```

API health check: `GET http://localhost:4000/health`

The development seed is safe to rerun and creates these accounts with password
`password123`: `player@footconnect.local`, `owner@footconnect.local`, and
`admin@footconnect.local`. It only runs when `NODE_ENV=development`.

When Expo runs on a physical phone, set `EXPO_PUBLIC_API_URL` in `.env` to the
computer's LAN address (for example `http://192.168.1.20:4000`), ensure both
devices are on the same network, and restart Expo. `localhost` on a phone points
to the phone itself. Android Emulator can use `http://10.0.2.2:4000`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @footconnect/api test:integration
```

The integration suite requires the local PostgreSQL and Redis services plus an applied migration.

## Monorepo layout

```text
apps/
  api/      Express backend (modular monolith)
  web/      Next.js pitch-owner dashboard
  mobile/   Expo React Native player app
packages/
  shared/      Zod schemas and shared types
  api-client/  Typed REST client
  ui/          Design tokens
  config/      TypeScript, ESLint, and Prettier configuration
infra/
  docker-compose.yml
```

The redesigned MVP is delivered through 14 dependency-ordered milestones, from baseline alignment through verified results, reliability, Elo, and Algiers pilot verification. Start with the [layered prompt-pack index](docs/superpowers/prompts/footconnect-core-mvp/README.md).
