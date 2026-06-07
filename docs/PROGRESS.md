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
| `packages/db/src/client.ts` — `$forTenant` extension    | ✅     | SET ROLE + set_config in transaction; `db.$forTenant(id, cb, opts)`                                                       |
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
