# ADR-0002 — WorkOS: Identity Only, No Organizations

## Context

WorkOS provides both identity (AuthKit — email/password + OAuth) and enterprise identity management
(Organizations, SAML, SCIM, Directory Sync). We need to decide how much of WorkOS to use for
multi-tenancy.

## Decision

WorkOS provides **identity only**. The canonical multi-tenant data model (tenants, memberships,
roles, invitations) lives entirely in our PostgreSQL database. We do **not** use WorkOS
Organizations in the current phase.

A WorkOS user is identified by `workos_user_id` (stored on the `users` table). After WorkOS
authenticates a user, our application looks up the user by `workos_user_id`, determines their
tenant memberships, selects the active tenant context, and sets `app.tenant_id` for the session.

WorkOS Organizations will be revisited when SAML/SCIM is needed (enterprise customers requiring
SSO federation). At that point we will evaluate syncing WorkOS Organization membership to our
`tenant_memberships` table.

## Consequences

- Session token from WorkOS contains only user identity (`workos_user_id`). Tenant resolution and
  RBAC checks happen in our application layer.
- Adding a user to a tenant requires writing a `tenant_memberships` row — WorkOS has no awareness
  of our tenancy.
- Invitation flow is fully owned by us (no WorkOS invitation system used).
- When SAML/SCIM is added later, an ADR must address the sync strategy between WorkOS Directory
  users/groups and our `tenant_memberships`.
