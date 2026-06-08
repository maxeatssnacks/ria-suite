# ADR-0005 — No platform-admin impersonation in v1

**Date:** 2026-06-07  
**Status:** Accepted

## Context

Support and troubleshooting sometimes requires acting as a specific tenant user.
A naive implementation (setting `session.userId` to another user's ID) would
leave no audit trail attributable to the platform admin, and would require the
affected user's consent to satisfy regulatory expectations.

## Decision

No impersonation in v1. If support needs to see a tenant's screen state,
we use screen-share with the tenant. Platform admins can VIEW (not modify)
tenant config and membership from the platform console.

## Consequences

- All support interactions remain fully audited — every platform action is
  performed by the platform admin's own identity with a required `reason`.
- Impersonation can be added later with: explicit consent flow (tenant-admin
  must approve each session), a separate audit event (`platform.impersonate_start`
  / `platform.impersonate_end`) recording both actor and target, and a clearly
  distinct UI state so the admin cannot accidentally act as the wrong user.
- Until then, screen-share is the support path.
