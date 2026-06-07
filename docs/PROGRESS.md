# Implementation Progress

## Part A — Monorepo, Tooling, Dev Environment

**Status:** Complete  
**Date:** 2026-06-06

### What was completed

| Task                                              | Status | Notes                                                                                      |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Turborepo + pnpm workspace init                   | ✅     | pnpm 11.5.2, Node 22 LTS pinned via `.nvmrc`                                               |
| `apps/web` — Next.js 15 App Router + TS strict    | ✅     | Turbopack for dev, standard webpack for build                                              |
| Tailwind CSS v4                                   | ✅     | Via `@tailwindcss/postcss`; `@theme inline` for CSS variable → utility mapping             |
| shadcn/ui initialized                             | ✅     | `components.json` configured; no components added yet                                      |
| Shared ESLint v9 flat config in `tooling/eslint`  | ✅     | Must include `files: ['**/*.ts','**/*.tsx']` — ESLint v9 doesn't match TS files without it |
| Shared tsconfig in `tooling/tsconfig`             | ✅     | base / nextjs / react-library variants                                                     |
| Stub packages: db, core, agent-runtime, audit, ui | ✅     | `export {}` placeholders; each has lint + typecheck scripts                                |
| `packages/db/SERVICE_ROLE_USAGE.md`               | ✅     | Empty catalogue, required by CLAUDE.md                                                     |
| GitHub Actions CI                                 | ✅     | lint → typecheck → test → build; pnpm version from `packageManager` field                  |
| Husky pre-commit: lint-staged + typecheck         | ✅     | Prettier on staged files, full `turbo typecheck`                                           |
| README                                            | ✅     | < 15 min onboarding instructions                                                           |
| `.env.example`                                    | ✅     | All future vars with part references                                                       |

### Deviations from spec

None. All items in the Part A spec were implemented as written.

### Decisions made (not ADRs — no architectural choices required at Part A)

- **pnpm v11** (not v9): Corepack resolved to pnpm 11.5.2. No functional difference for Part A;
  if a constraint requires v9 specifically, flag at Part B.
- **ESLint v9 flat config** used throughout. `apps/web` uses `FlatCompat` to bridge
  `eslint-config-next` (which still ships legacy format) into flat config.
- **`@theme inline`** directive required in Tailwind v4 to generate semantic color utilities
  (`bg-background`, `text-muted-foreground`, `border-border`, etc.) from CSS custom properties.
  Without it, `@apply border-border` fails at build time.
- **`pnpm-workspace.yaml` `allowBuilds`**: pnpm 11 requires explicit build approval for
  `sharp` and `unrs-resolver` (Next.js transitive deps). Both approved.

### Open questions resolved in Part B

1. **ORM decision** → Prisma v5 with raw SQL migrations containing RLS policies (ADR-0001).
2. **WorkOS tenant model** → WorkOS identity only, no Organizations (ADR-0002). Tenant → user
   mapping lives entirely in `tenant_memberships`.
3. **Module field in tsconfig** → switched to `"module": "ESNext" / "moduleResolution": "Bundler"`
   for all packages (ADR-0003). `tsx` used for standalone scripts.

---

## Part B — Database, Tenancy & RLS Foundation

**Status:** Complete  
**Date:** 2026-06-07

### What was completed

| Task                                                    | Status | Notes                                                                                                                     |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| ADR-0001: Prisma + restricted role + forTenant pattern  | ✅     | `docs/adr/0001-orm-rls-strategy.md`                                                                                       |
| ADR-0002: WorkOS identity only, no Organizations        | ✅     | `docs/adr/0002-workos-identity-only.md`                                                                                   |
| ADR-0003: Bundler module resolution for all packages    | ✅     | `docs/adr/0003-bundler-module-resolution.md`; tsconfig updated                                                            |
| `packages/db/prisma/schema.prisma`                      | ✅     | 8 models, 7 enums, full relations                                                                                         |
| `packages/db/prisma/migrations/20260607000000_initial/` | ✅     | Role creation, tables, TIMESTAMPTZ, helper functions, RLS, grants                                                         |
| `app_user` restricted Postgres role                     | ✅     | NOLOGIN NOINHERIT, no BYPASSRLS, grants match table-level permissions                                                     |
| `get_tenant_id()` / `get_user_id()` helper functions    | ✅     | SECURITY INVOKER; return NULL → deny when context unset                                                                   |
| `current_user_role()` helper                            | ✅     | SECURITY DEFINER to avoid RLS recursion in write policies                                                                 |
| RLS ENABLE + FORCE on all tenant-scoped tables          | ✅     | 6 tables: tenant_memberships, tenant_modules, audit_events, invitations, api_keys, (tenants/users via their own policies) |
| `packages/db/src/client.ts` — `$forTenant` extension    | ✅     | SET LOCAL ROLE + set_config in transaction; `db.$forTenant(id, cb, opts)`                                                 |
| `packages/db/src/seed.ts`                               | ✅     | 2 demo tenants, 6 roles each, 4 modules                                                                                   |
| `packages/db/tests/isolation.test.ts`                   | ✅     | 17 tests; programmatically generated per tenant-scoped table                                                              |
| `packages/db/tests/writes.test.ts`                      | ✅     | 7 tests; admin-only write gates, audit_events immutability                                                                |
| `packages/db/tests/rls-schema.test.ts`                  | ✅     | 2 tests; CI guard for missing RLS + app_user role properties                                                              |
| `packages/db/scripts/check-rls.ts`                      | ✅     | Standalone CI introspection script; exit 1 on violations                                                                  |
| `packages/db/SERVICE_ROLE_USAGE.md`                     | ✅     | 3 catalogued entries: seed, createServiceRoleClient, check-rls                                                            |
| `.env.example` updated                                  | ✅     | DATABASE_URL + DIRECT_URL with comments; Supabase vars removed                                                            |
| `turbo.json` test task `cache: false`                   | ✅     | Tests are stateful (embedded postgres); caching is wrong here                                                             |
| Prisma client generated                                 | ✅     | `prisma generate` from schema                                                                                             |

### Test results

```
Test Files  3 passed (3)
     Tests  26 passed (26)
  Duration  ~2.4s
```

### Deviations from spec

- **Supabase removed**: spec referenced Supabase in `.env.example`. The chosen approach (ADR-0001)
  uses raw Postgres + Prisma. Supabase can still be the hosting provider, but the client is Prisma,
  not `@supabase/supabase-js`. `.env.example` updated accordingly.
- **`tenants` table has RLS**: spec didn't explicitly require it but the isolation design requires
  it. `tenants_select` policy allows `id = get_tenant_id()`. Pre-auth lookups by slug must use
  service_role (documented in SERVICE_ROLE_USAGE.md).
- **`audit_events` INSERT-only for app_user**: no UPDATE or DELETE policy. Immutability enforced
  at the DB level, not just application convention.

### Open questions for Part C

1. **Prisma migrate baseline**: For a real hosted Postgres (Supabase or otherwise), the migration
   must be applied via `prisma migrate deploy` against DIRECT_URL. The embedded-postgres in tests
   runs the SQL directly. These paths need to be documented in the README.
2. **`DATABASE_URL` format for pgBouncer**: if Supabase's connection pooler is used, add
   `?pgbouncer=true&connection_limit=1` to the URL to prevent prepared statement conflicts.
3. **`app_user` login password** in hosted Postgres: the migration creates `app_user NOLOGIN`.
   To grant login, run: `ALTER ROLE app_user LOGIN PASSWORD '...'`. This should be a one-time
   setup step in a hosting runbook, not in the migration itself.

---

## Part B — Follow-up: Privilege-Parity Fix & Test Hardening

**Status:** Complete  
**Date:** 2026-06-07

### Discovery

Hosted verification (manual cross-tenant SQL check) revealed that `SET LOCAL ROLE app_user` failed
on Supabase with `permission denied to set role "app_user"`. Root cause: Supabase's connecting role
(`postgres`) is **not a superuser** on hosted Postgres — it requires explicit membership in a role to
switch to it via `SET [LOCAL] ROLE`. Local tests passed without catching this because embedded-postgres
connects as a true superuser, which can `SET ROLE` to any role without membership.

A manual hotfix (`GRANT app_user TO postgres;`) was applied on hosted. Human-verified cross-tenant
SQL check result: **6 / 0 / 0** (6 own-tenant rows visible, 0 cross-tenant rows visible, 0 rows
visible with no context).

### What was completed

| Task                                                   | Status | Notes                                                                                                                                                                                        |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260607000001_grant_app_user_to_connector` migration | ✅     | DO block: if `current_user` is not a superuser, `GRANT app_user TO current_user`. Idempotent — safe to re-apply. No-ops on embedded-postgres (true superuser); fires on hosted Supabase.     |
| Migration deployed to hosted Supabase                  | ✅     | `prisma migrate deploy` — applied cleanly; idempotent over the manual hotfix                                                                                                                 |
| `app_connect` non-superuser test role                  | ✅     | `setup.ts` creates `NOSUPERUSER LOGIN` role and explicitly grants `app_user` to it, mirroring hosted Postgres privileges                                                                     |
| `applyMigrations()` in test setup                      | ✅     | Reads all migration dirs sorted — new migrations picked up automatically                                                                                                                     |
| Connector-path isolation tests                         | ✅     | 3 new tests: `app_connect` connects, `SET LOCAL ROLE app_user`, verifies own-tenant visible / cross-tenant invisible. Fails with clear `permission denied` if the membership grant is absent |
| SET LOCAL ROLE no-leak tests                           | ✅     | 2 new tests: verify `current_user` is `app_user` mid-transaction, reverts to `app_connect` after COMMIT and ROLLBACK respectively                                                            |
| Misleading comment fixed in `client.ts`                | ✅     | Line ~35 said "Sets SET ROLE" — corrected to "Sets SET LOCAL ROLE" to match the implementation                                                                                               |
| `getConnectorConnUrl()` exported from `tests/setup.ts` | ✅     | Returns `app_connect` URL for use in connector-path tests                                                                                                                                    |

### Test results

```
Test Files  3 passed (3)
     Tests  31 passed (31)   ← was 26; +5 new tests
  Duration  ~2.3s
```

### Deviations from spec

None — this was a follow-up hardening session, not a spec part.

### Open questions for Part C

_(same as above — none added)_

---

## Part C — Authentication (WorkOS)

**Status:** Code complete — human verification pending  
**Date:** 2026-06-07

### What was completed

| Task                                      | Status | Notes                                                                                                                                                                                          |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WorkOS AuthKit integration                | ✅     | `@workos-inc/node` only (no `authkit-nextjs`); full control per ADR-0002. Hosted auth pages via WorkOS.                                                                                        |
| Iron-session HttpOnly cookie              | ✅     | `iron-session` v8. Session stores `{ userId, workosUserId, email, name, tenantId?, role?, tenants[] }`. HttpOnly, SameSite=Lax, 7-day TTL, Secure in production.                               |
| JIT user provisioning                     | ✅     | `/auth/callback` upserts `users` row on every login (keyed by `workos_user_id`). No tenant access until membership exists.                                                                     |
| Tenant list cached in session             | ✅     | Login fetches all active memberships via service role once; stored in session to avoid per-request cross-tenant queries.                                                                       |
| Middleware auth gating                    | ✅     | `src/middleware.ts` — decrypts session, redirects to `/auth/login` if no userId, to `/switch-tenant` or `/no-access` if no tenantId.                                                           |
| Dashboard                                 | ✅     | `/(app)/dashboard` — shows current tenant name, role, user name.                                                                                                                               |
| No-access screen                          | ✅     | `/(app)/no-access` — shown when authenticated but no active tenant membership.                                                                                                                 |
| Tenant switcher                           | ✅     | `/(app)/switch-tenant` — lists all user tenants (from session), server action updates session + audit-logs.                                                                                    |
| Logout                                    | ✅     | `GET /auth/logout` — destroys session cookie, audit-logs, redirects to login.                                                                                                                  |
| Invitation: send                          | ✅     | `POST /api/invitations` — `can()` gate (tenant_admin), token = 32-byte random hex, SHA-256 hash stored; Resend email with 7-day link.                                                          |
| Invitation: accept                        | ✅     | `GET/POST /invite/[token]` — hash lookup (service role), membership creation, session update, audit-log. Email match enforced. Invalid/expired/used tokens → `notFound()` (no existence leak). |
| `packages/core` — types, schemas, `can()` | ✅     | `TenantRole`, `SessionData`, `InvitationCreate`, `SwitchTenant` Zod schemas. `can(user, action)` with role-rank hierarchy.                                                                     |
| `packages/audit` — interim write path     | ✅     | `writeAuditEvent()` via service-role Prisma. **Interim until Part E** (see below).                                                                                                             |
| ADR-0004 — SAML/SCIM deferred             | ✅     | `docs/adr/0004-saml-scim-deferred.md` — documents deferral and the exact upgrade path when needed.                                                                                             |
| SERVICE_ROLE_USAGE.md — entries #4-#6     | ✅     | Audit writer, login tenant list fetch, invitation pre-auth lookup all catalogued.                                                                                                              |
| README — `app_user` section corrected     | ✅     | Removed misleading "grant LOGIN, connect as app_user" paragraph; replaced with the real `SET LOCAL ROLE` runtime pattern.                                                                      |
| `.env.example` updated                    | ✅     | Added `SESSION_SECRET`, `WORKOS_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL`, `RESEND_FROM_ADDRESS`.                                                                                                   |
| Build passes                              | ✅     | `next build` succeeds. 10 routes compiled (all dynamic). All 3rd-party clients lazy-initialized to avoid build-time env-var failures.                                                          |
| Typecheck passes                          | ✅     | All 8 packages clean.                                                                                                                                                                          |
| Tests passing                             | ✅     | 31/31 (Part B tests unchanged).                                                                                                                                                                |

### Audit events implemented

| Event                 | Trigger                         | Notes                                |
| --------------------- | ------------------------------- | ------------------------------------ |
| `user.login`          | `/auth/callback`                | tenantId set if single-tenant user   |
| `user.logout`         | `/auth/logout`                  | tenantId from session at logout time |
| `invitation.sent`     | `POST /api/invitations`         | metadata: email, role                |
| `invitation.accepted` | `/invite/[token]` server action | metadata: role, email                |
| `tenant.switched`     | `/switch-tenant` server action  | metadata: from, to tenant IDs        |

### Interim audit client (flagged per instruction)

`packages/audit/src/index.ts` uses `createServiceRoleClient()` (DIRECT_URL) for every audit write. This is correct for auth-layer events that occur outside `forTenant()` transactions, but it opens a new connection per write which is suboptimal at scale. Part E's full typed client will use a persistent singleton and a proper queue.

### Deviations from spec

- **`@workos-inc/node` only** (not `authkit-nextjs`): Per ADR-0002, WorkOS provides identity only. Using the lower-level SDK gives full control over the session. `authkit-nextjs` would add a second session cookie and interfere with our own iron-session.
- **Tenant list in session cookie**: The spec says "server-side session with our user_id, active tenant_id, role." We also cache the full tenant list in the session to enable the tenant switcher without a cross-tenant DB query on every page load. The cookie remains HttpOnly/encrypted/server-only — no client exposure.
- **Resend integrated in Part C**: The spec listed Resend under Part F (background jobs), but the invitation email is a core Part C requirement. Integrated now; Part F will add background job wrapping (retry, queue) if needed.
- **Dev fallback for invitation email**: When `RESEND_API_KEY` is not set, the invitation route skips the Resend call and logs the full accept URL to the server console (prefixed `[invitations] DEV`). This allows the full invite→accept flow to be tested locally without a Resend account. Resend wired for real in Part F.
- **Logout bug fixed (human verification finding)**: Original logout redirected to `/auth/login` which auto-forwarded to WorkOS; WorkOS's live IdP session silently re-authenticated, recreating the app session. Fix: (1) store WorkOS session ID (`sid` JWT claim from access token) in iron-session at callback time; (2) on logout, call `getLogoutUrl({ sessionId })` to redirect through WorkOS's logout endpoint, terminating the IdP session; (3) land on a new public `/auth/signed-out` page with a sign-in button instead of auto-redirecting into the login flow. `workosSessionId` added to `SessionDataSchema` in `@ria/core`.

### Verification checklist (human)

- [ ] Sign up / first login via WorkOS AuthKit → JIT user row created in `users`
- [ ] Single-tenant user → lands on `/dashboard` with correct tenant name and role
- [ ] Multi-tenant user → lands on `/switch-tenant`; switching tenant updates session; `/dashboard` reflects new tenant
- [ ] Authenticated user with no memberships → `/no-access`
- [ ] `tenant_admin` sends invitation via `POST /api/invitations` → accept URL logged to console (dev) or email delivered (prod)
- [ ] Invitee opens accept link → membership created, session updated, redirected to `/dashboard`
- [ ] Tenant A session cannot access Tenant B resources (middleware + RLS)
- [ ] Logout → iron-session cookie cleared, WorkOS IdP session terminated (no silent re-auth), lands on `/auth/signed-out` with sign-in button (not auto-redirected back into login flow)
- [ ] Audit events present in `audit_events` table for: `user.login`, `user.logout`, `invitation.sent`, `invitation.accepted`, `tenant.switched`

### Open questions for Part D

1. **`WORKOS_REDIRECT_URI`** must be set in `.env` for local dev and configured in the WorkOS dashboard. Default fallback is `http://localhost:3000/auth/callback`.
2. **`RESEND_FROM_ADDRESS`** must be a verified domain in Resend. The placeholder `noreply@ria.example.com` will not deliver in production.
3. **Session revalidation**: The tenant list is cached in the session at login time. If a user's memberships change (invitation accepted in another browser, role change), their session won't reflect it until next login. Part D or E should add a "refresh session" mechanism.
4. **MFA enrollment prompt**: Deferred within Part C — WorkOS can surface this via AuthKit settings. No app-side changes needed for enforcement; the prompt comes from WorkOS's hosted auth page.

---

## Part C — Follow-up: Prisma Monorepo Resolution & Loud Accept Failures

**Status:** Complete  
**Date:** 2026-06-07

### Symptom (from dev-server logs)

Invitation accept silently failed: `POST /invite/[token]` returned `200` with no membership
created and no redirect. Every request logged `Package @prisma/client can't be external … could
not be resolved by Node.js from the project directory` (twice — once for `.prisma/client`, once
for `packages/db/src`). After the second Accept click the dev server hard-crashed with
`[ELIFECYCLE] Command failed`.

### Root cause

`@prisma/client` is in Next.js's default `serverExternalPackages` list and **must** stay external —
it loads a native query-engine binary that cannot be bundled. Because it's external, Next emits a
runtime `require('@prisma/client')` that Node resolves from the **app** directory (`apps/web`), not
from `@ria/db` where it is imported. Under pnpm's isolated `node_modules`, `@prisma/client` was a
dependency of `packages/db` only, so it was absent from `apps/web/node_modules` and the require
failed at request time. `transpilePackages` transpiles our workspace TS but does **not** make an
externalized third-party package resolvable from the app.

Two failures stacked on top:

- The inline server action ignored `acceptInvitation`'s return value, so a thrown Prisma error (or
  a validation `{ error }`) produced a bare `200` with no user-visible signal.
- The `invitation.accepted` audit write was fire-and-forget (`void writeAuditEvent(...)`) with no
  `.catch`. When it rejected on the Prisma resolution failure, the **unhandled promise rejection**
  took down the dev process — the `[ELIFECYCLE]` crash.

### Fix

| Change                                                                                                                               | File                                                                              | Why                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Added `@prisma/client` (dep) + `prisma` (devDep) to `apps/web`                                                                       | `apps/web/package.json`                                                           | The standard pnpm + Next fix: makes the externalized `@prisma/client` resolvable from the app dir. `@prisma/client` stays external (native binary); we did **not** remove it from `serverExternalPackages`. |
| Documented the _why_ of the otherwise-unused dep                                                                                     | `apps/web/next.config.ts`                                                         | Prevents a future "unused dependency" cleanup from reintroducing the bug.                                                                                                                                   |
| Accept action catches + logs all errors, returns `{ error }`; `redirect()` moved outside the try/catch so `NEXT_REDIRECT` propagates | `apps/web/src/app/invite/[token]/actions.ts`                                      | Failures are now loud server-side and surfaced to the user.                                                                                                                                                 |
| Action converted to a `useActionState`-compatible signature; new client component renders the error state                            | `apps/web/src/app/invite/[token]/{actions.ts,accept-form.tsx,page.tsx}`           | The invite page shows an inline error instead of silently re-rendering on `200`.                                                                                                                            |
| Every fire-and-forget `writeAuditEvent` now has `.catch((err) => console.error(...))`                                                | invite action, `auth/logout`, `auth/callback`, `api/invitations`, `switch-tenant` | An audit write rejection can never produce an unhandled rejection / crash the process.                                                                                                                      |
| `argsIgnorePattern: '^_'` added to the web ESLint config                                                                             | `apps/web/eslint.config.mjs`                                                      | `next/typescript` enabled `no-unused-vars` without the repo's `_`-prefix convention, flagging the required-but-unused `useActionState` params. Now aligned with `tooling/eslint`.                           |

**Decision (recorded here, not a standalone ADR):** keep `@prisma/client` external and install it in
`apps/web` rather than forcing it to bundle. Bundling Prisma's query engine is unsupported and
fragile; installing the package in the consuming app is Prisma's and Next's documented monorepo
guidance. This is a build-tooling fix, not an architectural choice, so it lives in PROGRESS rather
than `docs/adr`.

### Verification

- Dev server restarted: **0** `can't be external` warnings (previously on every request), **0**
  `ELIFECYCLE` crashes.
- `GET /invite/<bogus-token>` → `404` — proves the service-role Prisma `findUnique` now executes
  against the real DB at runtime (returns nothing → `notFound()`), the exact path that was failing.
- `POST /api/invitations` (no session) → `401` — route compiles and runs.
- `pnpm --filter @ria/web typecheck` clean; `lint` clean; `build` succeeds (12 routes;
  `/invite/[token]` now ships a client bundle for the error-rendering form).
- Full browser accept→membership flow still requires an interactive WorkOS login + a live
  invitation; not exercisable headlessly. The Prisma resolution and loud-failure paths are verified
  as above.
