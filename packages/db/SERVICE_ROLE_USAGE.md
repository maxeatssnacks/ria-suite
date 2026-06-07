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

### 4 — `packages/audit/src/index.ts` — `writeAuditEvent()`

- **Path**: `packages/audit/src/index.ts` → `writeAuditEvent()`
- **Reason**: Auth-layer events (login, logout, invitation accepted, tenant switch) occur
  outside `forTenant()` transactions where `app_user` context is not yet established.
  The service role is the only way to insert these events without establishing a
  spurious tenant context. The interim implementation (Part C) creates a short-lived
  service-role client per write; Part E will replace this with a persistent singleton.
- **Audit**: N/A — this function IS the audit writer; it does not write a secondary event.
- **Added**: 2026-06-07

### 5 — `apps/web/src/app/auth/callback/route.ts` — tenant list fetch

- **Path**: `apps/web/src/app/auth/callback/route.ts`
- **Reason**: After WorkOS identifies the user, we need to load all of their active tenant
  memberships to populate the session. The `tenant_memberships` RLS requires a set
  `app.tenant_id`, so we cannot use `forTenant()` for a cross-tenant list query. Service
  role is used for this one-time-per-login lookup only.
- **Audit**: YES — `writeAuditEvent({ action: 'user.login', ... })` is called in the same handler.
- **Added**: 2026-06-07

### 6 — `apps/web/src/app/invite/[token]/actions.ts` — invitation pre-auth lookup

- **Path**: `apps/web/src/app/invite/[token]/actions.ts` → `acceptInvitation()`
- **Reason**: Looking up an invitation by token hash requires reading from `invitations`,
  which has RLS requiring tenant context. The accepting user does not yet belong to the
  target tenant, so we cannot establish that context. Service role is used only for the
  lookup and the membership creation; the invitation is marked accepted in the same call.
- **Audit**: YES — `writeAuditEvent({ action: 'invitation.accepted', ... })` is called.
- **Added**: 2026-06-07

## Guidelines

- Service-role clients MUST only be instantiated in server-side code
  (API routes, server actions, Inngest handlers, migration scripts).
- Each production use MUST be accompanied by a write to the audit log via `@ria/audit`.
- No service-role client may be instantiated or referenced in client components
  or `NEXT_PUBLIC_*` code paths.
- This file is reviewed during every security review.
- To add an entry: `git blame` to find the PR, add an entry here in the same commit.
