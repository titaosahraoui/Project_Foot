# API modules (modular monolith)

Each bounded context lives under `src/modules/<name>/` and normally follows this shape:

```text
<name>/
  <name>.routes.ts       Express router mounted in src/app.ts
  <name>.controller.ts   Request parsing and response mapping
  <name>.service.ts      Business logic and the module's public surface
  <name>.repository.ts   Private Prisma data access
  <name>.schemas.ts      Zod schemas or re-exports from @footconnect/shared
```

## Boundary rule

A module may import another module's `*.service.ts`. It must never import another module's `*.repository.ts` or directly access another module's Prisma-owned data.

Shared Zod contracts belong in `@footconnect/shared`; API modules consume those contracts rather than duplicating request and response shapes.

## Current status

| Module          | Status                     | Next owning milestone                                                 |
| --------------- | -------------------------- | --------------------------------------------------------------------- |
| `health`        | Implemented foundation     | M14 adds worker health and pilot observability                        |
| `auth`          | Partial implementation     | M03 hardens sessions, authorization, and rate limits                  |
| `users`         | Partial implementation     | M03 aligns player profiles and roles                                  |
| `teams`         | Partial implementation     | M04 adds captain transfer, cards, formations, and lineups             |
| `pitches`       | Partial implementation     | M05 adds DZD pricing, exact inventory, closures, and owner operations |
| `bookings`      | `501` route stub           | M08 implements organizer booking; M10 adds outcomes and reliability   |
| `matches`       | `501` route stub           | M09 implements scheduled matches; M11 adds verified results           |
| `notifications` | `501` route stub           | M13 implements the inbox, deadlines, and reminders                    |
| `social`        | `501` route stub, deferred | Post-MVP; the social layer is not part of the competitive core        |
| `matchmaking`   | Absent                     | M06 adds availability and recommendations; M07 adds challenges        |
| `ratings`       | Absent                     | M12 owns Elo, records, history, and leaderboards                      |
| `admin`         | Absent                     | M10 and M11 add audited dispute resolution; M13 integrates the UI     |

The competitive flow uses recommendations followed by captain-controlled challenges. Challenge acceptance records agreement to play; the organizer requests an exact pitch booking afterward. Both captains and the pitch owner independently submit the final score, and only a verified consensus or audited resolution can trigger Elo. Objective team reliability is calculated separately from resolved booking outcomes to protect pitch owners.

See the [baseline audit](../../../../docs/baseline-audit-2026-08-11.md), [approved design](../../../../docs/superpowers/specs/2026-08-11-footconnect-core-mvp-design.md), and [implementation prompt index](../../../../docs/superpowers/prompts/footconnect-core-mvp/README.md) for evidence and delivery details.
