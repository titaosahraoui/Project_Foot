# Milestone 03 — Authentication and Player Profiles

**Outcome:** Authentication is durable without Redis session state, roles are enforceable, and profile contracts work across API, mobile, and web.

## M03-T01 — Tighten player-profile contracts

```text
Implement only M03-T01 with TDD.

Files:
- Modify packages/shared/src/user.ts and auth.ts.
- Create packages/shared/src/user.test.ts.

Add PlayerPosition with GK, DEF, MID, FWD, and FLEX. Replace free-form profile position with the
nullable enum. Require displayName after trimming to contain 1–50 characters. Bio remains at
most 500 characters. Avatar remains an HTTPS URL or null. Location requires lat and lng together;
reject payloads containing only one coordinate. AuthUser must expose the same canonical fields.

Tests cover trimming, invalid position, insecure avatar URL, paired coordinates, coordinate
bounds, and explicit null clearing.

Run:
pnpm --filter @footconnect/shared test -- src/user.test.ts
pnpm --filter @footconnect/shared typecheck

Commit as:
feat(shared): tighten player profile contracts
```

## M03-T02 — Move refresh sessions to PostgreSQL

```text
Implement only M03-T02 with integration tests first.

Files:
- Modify apps/api/prisma/schema.prisma and create migration add_refresh_sessions.
- Modify apps/api/src/modules/auth/auth.repository.ts and auth.service.ts.
- Modify apps/api/src/modules/auth/auth.integration.test.ts.

Add RefreshSession with jti as the primary key, userId relation, expiresAt, revokedAt,
replacedByJti, createdAt, and lastUsedAt. Replace Redis JTI methods with database methods.
Rotation must transactionally revoke the old session and create the replacement. A replayed,
revoked, expired, or unknown token returns 401. Logout revokes the session and remains idempotent.
Do not remove Redis from infrastructure because later milestones use it for jobs.

Integration tests prove registration creates a session, refresh rotates once, replay fails,
logout revokes, and deleting a user cascades sessions.

Run:
pnpm --filter @footconnect/api prisma:migrate
pnpm --filter @footconnect/api test:integration -- auth.integration.test.ts
pnpm --filter @footconnect/api typecheck

Commit as:
feat(auth): persist rotating refresh sessions
```

## M03-T03 — Add reusable role authorization

```text
Implement only M03-T03 with TDD.

Files:
- Create apps/api/src/middleware/require-role.ts and require-role.test.ts.
- Modify apps/api/src/types/express.d.ts so `req.userRoles` is typed as `UserRole[]`.

Export requireRole(...allowedRoles: UserRole[]) as Express middleware. It must require a prior
authenticated request, return 401 UNAUTHENTICATED when user context is absent, return 403
FORBIDDEN when no allowed role matches, and call next once for an allowed role. Do not infer the
CAPTAIN team role from global user roles; team services continue to check membership.

Run:
pnpm --filter @footconnect/api test -- src/middleware/require-role.test.ts
pnpm --filter @footconnect/api typecheck

Commit as:
feat(auth): add role authorization middleware
```

## M03-T04 — Complete profile API and typed client

```text
Implement only M03-T04 with integration tests first.

Files:
- Modify apps/api/src/modules/users/users.controller.ts, users.service.ts, and users.repository.ts.
- Modify apps/api/src/modules/users/users.integration.test.ts, creating it if absent.
- Modify packages/api-client/src/index.ts.

Keep GET /api/v1/users/me and PATCH /api/v1/users/me. Apply the tightened shared schemas, paired
location semantics, and safe response mapping. Add ApiClient.getMyProfile() and
ApiClient.updateMyProfile(input). Do not duplicate AuthUser locally.

Integration tests cover unauthenticated access, field updates, null clearing, invalid position,
partial coordinates, and absence of passwordHash/refresh sessions in responses.

Run:
pnpm --filter @footconnect/api test:integration -- users.integration.test.ts
pnpm --filter @footconnect/api-client typecheck

Commit as:
feat(users): complete typed player profiles
```

## M03-T05 — Complete profile editing on mobile and web

```text
Implement only M03-T05.

Files:
- Modify apps/mobile/src/screens/ProfileScreen.tsx and auth-context.tsx.
- Create focused mobile profile form components under apps/mobile/src/components/profile/.
- Modify apps/web/src/app/page.tsx only to link authenticated users to profile settings.
- Create apps/web/src/app/profile/page.tsx.

Read the required Expo and local Next.js documentation first. Build controlled forms using the
shared profile types. Support display name, position, skill level, bio, avatar HTTPS URL, and
paired location. On save, update TanStack Query caches and auth context. Display field-level
validation and retryable API errors; never clear unsaved input on failure.

Verification:
pnpm --filter @footconnect/mobile typecheck
pnpm --filter @footconnect/web typecheck
pnpm --filter @footconnect/web build

Manually verify loading, save success, invalid coordinate pair, server failure, and sign-out.

Commit as:
feat(profile): complete player profile editing
```

## Milestone 03 gate

```powershell
pnpm --filter @footconnect/api test:integration
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```
