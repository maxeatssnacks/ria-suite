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

### 7 — `apps/web/src/lib/refresh-session.ts` — per-page session membership refresh

- **Path**: `apps/web/src/lib/refresh-session.ts` → `refreshSessionMemberships()`
- **Reason**: Reading all of a user's active memberships across tenants is a
  cross-tenant query — it requires seeing memberships for every tenant the user
  belongs to, not just the currently active one. The `tenant_memberships` RLS
  SELECT policy is scoped to `get_tenant_id()`, so `forTenant()` only reveals
  one tenant at a time. Service role is the only way to do this cross-tenant
  membership list in one query. Called from `(app)/layout.tsx` on every page
  navigation to keep the session fresh after role changes or new invitations.
- **Audit**: N/A — read-only; no mutation.
- **Added**: 2026-06-07

### 8 — `apps/web/src/app/(app)/admin/settings/actions.ts` — tenant settings update

- **Path**: `apps/web/src/app/(app)/admin/settings/actions.ts` → `updateSettings()`
- **Reason**: The `tenants` table only grants `SELECT` to `app_user`; there is no
  UPDATE policy. Tenant settings mutations (name, timezone, notification prefs)
  require service role. Role is checked at the application layer: `can({ role },
'tenant.update_settings')` requires `tenant_admin`.
- **Audit**: YES — `writeAuditEvent({ action: 'tenant.update_settings', ... })`.
- **Added**: 2026-06-07

### 9 — `apps/web/src/app/(app)/admin/settings/page.tsx` — tenant settings read

- **Path**: `apps/web/src/app/(app)/admin/settings/page.tsx`
- **Reason**: Reads the tenant row (including the `settings` JSON) to populate the
  settings form. The `tenants` SELECT policy works via `forTenant`, but we also
  need to bypass RLS to read settings outside a forTenant context. Simpler to use
  service role consistently with the write path. Read-only; no mutations here.
- **Audit**: N/A — read-only page render.
- **Added**: 2026-06-07

### 10 — `apps/web/src/app/(app)/admin/modules/page.tsx` — module catalog read

- **Path**: `apps/web/src/app/(app)/admin/modules/page.tsx`
- **Reason**: The module catalog (`modules` table) is a global table with no tenant
  scoping. While `app_user` has SELECT on it, reading it requires setting a tenant
  context in `forTenant`. Using service role for the global catalog read avoids
  coupling the catalog lookup to the tenant context unnecessarily.
- **Audit**: N/A — read-only page render.
- **Added**: 2026-06-07

### 11 — `apps/web/src/app/(app)/admin/audit/page.tsx` — actor name lookup

- **Path**: `apps/web/src/app/(app)/admin/audit/page.tsx` and
  `apps/web/src/app/api/audit/export/route.ts`
- **Reason**: After fetching audit events (via `forTenant`), actor names and emails
  are resolved from the `users` table. The `users_select` RLS policy only exposes
  users who currently have an active membership in the tenant — it would miss actors
  who have since been removed. Service role ensures the audit log always shows who
  performed an action even if that person is no longer a member.
- **Audit**: N/A — read-only.
- **Added**: 2026-06-07

### 12 — `apps/web/src/app/(platform-admin)/platform/...` — all platform-admin operations

- **Path**: All files under `apps/web/src/app/(platform-admin)/platform/`
- **Reason**: Platform admin operations (create tenant, suspend tenant, activate
  module) are cross-tenant by definition. There is no single tenant context to
  establish; service role is the only correct tool. Every operation is gated by
  `can({ role }, 'platform.*')` (requires `platform_admin` role) and writes a
  mandatory audit event with a required `reason` field.
- **Audit**: YES — every mutation writes `writeAuditEvent(...)` with `reason`.
- **Added**: 2026-06-07

## Guidelines

- Service-role clients MUST only be instantiated in server-side code
  (API routes, server actions, Inngest handlers, migration scripts).
- Each production use MUST be accompanied by a write to the audit log via `@ria/audit`.
- No service-role client may be instantiated or referenced in client components
  or `NEXT_PUBLIC_*` code paths.
- This file is reviewed during every security review.
- To add an entry: `git blame` to find the PR, add an entry here in the same commit.
