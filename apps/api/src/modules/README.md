# API modules (modular monolith)

Each bounded context is a folder under `src/modules/<name>/` with this shape:

```
<name>/
  <name>.routes.ts       Express Router, mounted in src/app.ts
  <name>.controller.ts   parse request -> call service -> send response
  <name>.service.ts      business logic; the module's PUBLIC surface
  <name>.repository.ts    Prisma data access; PRIVATE to the module
  <name>.schemas.ts      Zod schemas (or re-export from @footconnect/shared)
```

## The one rule

A module may import another module's `*.service.ts`.
A module must **never** import another module's `*.repository.ts` or touch its
Prisma models directly. This keeps contexts isolated and makes extracting a
module into its own service later a mechanical change.

## Status

- `health/` — fully implemented (reference for the convention).
- `auth`, `users`, `teams`, `pitches`, `bookings`, `matches`, `social`,
  `notifications` — stub routers returning `501` until their roadmap phase.
