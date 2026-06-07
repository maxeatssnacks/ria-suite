# ADR-0001 — ORM and RLS Strategy

## Context

We need a multi-tenant data layer where cross-tenant access is physically impossible at the database
layer. Our auth provider is WorkOS (not Supabase Auth), so the standard Supabase JWT + `auth.uid()`
RLS pattern does not apply.

## Decision

**Prisma** owns schema definition and migration files. RLS policies are raw SQL co-located in the
same migration file (`migration.sql`) alongside Prisma's generated DDL.

The application connects as a **restricted Postgres role** (`app_user`) with no `BYPASSRLS` and no
table ownership — only the grants it needs. This role is created idempotently in the first migration.

**Tenant context pattern**: every tenant-scoped operation executes inside a `$transaction` that
first calls `SELECT set_config('app.tenant_id', $1, true)` (transaction-local). This is implemented
once in a Prisma client extension exposing `db.$forTenant(tenantId, callback, { userId? })`.
Business code never sets config manually and cannot skip it.

RLS policies key on `get_tenant_id()` — a `SECURITY INVOKER` helper that reads the session setting.
Write policies additionally call `current_user_role()` — a `SECURITY DEFINER` function that looks
up the caller's membership role. SECURITY DEFINER avoids RLS recursion when write policies query
`tenant_memberships`.

The Supabase JS client is NOT used as the primary data path — only for storage/realtime if needed.
Supabase `service_role` key is used only in explicitly named code paths catalogued in
`packages/db/SERVICE_ROLE_USAGE.md`.

## Consequences

- Every new tenant-scoped table must: add `tenant_id UUID NOT NULL`, `ALTER TABLE ... ENABLE ROW
LEVEL SECURITY`, `ALTER TABLE ... FORCE ROW LEVEL SECURITY`, and appropriate policies. A CI check
  (`packages/db/scripts/check-rls.ts`) fails if any table with `tenant_id` is missing these.
- `prisma migrate dev` generates TIMESTAMP(3) by default; we manually write TIMESTAMPTZ for all
  date fields. Future contributors must continue this pattern in manual migration files.
- The `db.$forTenant` callback pattern (vs. a bare `db.forTenant(id)` returning a client) is
  required because Prisma cannot lazily start a transaction; the config must be set at the head of
  a specific transaction that wraps the queries.
