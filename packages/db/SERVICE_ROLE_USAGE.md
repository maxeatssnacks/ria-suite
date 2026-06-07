# Service-Role Usage Catalogue

This file documents every code path that bypasses Row-Level Security (RLS) by
running as the database superuser (direct connection, no `app_user` role).
Entries are mandatory per the project constitution (CLAUDE.md).

## Format

Each entry must include:

- **Path**: file + function/route
- **Reason**: why RLS bypass is required
- **Audit**: whether an audit log event is written (must be YES for production paths)
- **Added**: date added

## Entries

### 1 — `packages/db/src/seed.ts` — seed script

- **Path**: `packages/db/src/seed.ts` → `main()`
- **Reason**: Bootstraps tenants, users, and memberships before any tenant context
  can be established. Runs in dev/CI only; never in production data paths.
- **Audit**: N/A — development seed script, not a production code path
- **Added**: 2026-06-07

### 2 — `packages/db/src/client.ts` — `createServiceRoleClient()`

- **Path**: `packages/db/src/client.ts` → `createServiceRoleClient()`
- **Reason**: Provides a direct-connection client for pre-auth lookups (e.g.
  tenant slug → tenant ID during the WorkOS OAuth callback, before tenant context
  is available). Connects via `DIRECT_URL` as the superuser.
- **Audit**: YES — callers MUST write an `audit_events` row. The service-role
  client itself does not write audit events; the call site is responsible.
- **Added**: 2026-06-07
- **Known callers**: WorkOS callback route (Part C)

### 3 — `packages/db/scripts/check-rls.ts` — RLS introspection script

- **Path**: `packages/db/scripts/check-rls.ts`
- **Reason**: Reads `pg_class` system catalog to verify RLS policies. Must run
  as a role that can see `relrowsecurity` / `relforcerowsecurity`. CI only.
- **Audit**: N/A — read-only CI script; no mutation.
- **Added**: 2026-06-07

## Guidelines

- Service-role clients MUST only be instantiated in server-side code
  (API routes, server actions, Inngest handlers, migration scripts).
- Each production use MUST be accompanied by a write to the audit log via `@ria/audit`.
- No service-role client may be instantiated or referenced in client components
  or `NEXT_PUBLIC_*` code paths.
- This file is reviewed during every security review.
- To add an entry: `git blame` to find the PR, add an entry here in the same commit.
