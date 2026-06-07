# ADR-0004 — SAML / SCIM: Deferred to Enterprise Tier

## Context

WorkOS supports SAML SSO and SCIM directory sync via "Organizations" — a WorkOS construct that
maps an identity provider to a set of users. Enterprise RIA customers may require SSO for
compliance or IT-policy reasons (e.g., "employees must authenticate through our IdP").

In the current phase, all customers use WorkOS AuthKit (email/password + Google OAuth).

## Decision

SAML and SCIM are **deferred** until the first enterprise customer requires them. No WorkOS
Organization objects are created for current tenants (ADR-0002).

## Upgrade Path

When SAML/SCIM is needed:

1. **Create a WorkOS Organization** for the enterprise tenant (`workos.organizations.create`).
   Store the `workos_organization_id` on our `tenants` row (requires a migration to add the column).

2. **Configure SAML connection** via WorkOS dashboard (or API). WorkOS handles the IdP metadata
   exchange; we receive a webhook when the connection is verified.

3. **SCIM provisioning**: WorkOS can push user create/update/deactivate events to a webhook we
   expose (`POST /api/workos/scim`). The handler:
   - On user create: upsert our `users` row, create `tenant_memberships` row with the mapped role.
   - On user update: sync email/name to `users`.
   - On user deactivate: set `tenant_memberships.status = 'disabled'`.

4. **Login flow change**: for enterprise tenants, the WorkOS auth URL includes
   `organizationId` instead of `provider: 'authkit'`. Our callback route must handle both
   flavors. The session-building logic (JIT provision + membership lookup) is unchanged.

5. **Write ADR-0005** at that point covering the exact sync strategy (full replace vs. delta,
   group → role mapping, conflict handling for users who also have AuthKit memberships).

## Consequences

- No SAML/SCIM surface area in the current codebase.
- The `tenants` table will need a nullable `workos_organization_id` column when this is built.
- Invitation flow (Part C) is only used for non-SAML tenants; SCIM replaces it for enterprise.
