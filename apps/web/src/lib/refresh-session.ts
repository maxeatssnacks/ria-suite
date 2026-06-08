import type { IronSession } from 'iron-session'
import { createServiceRoleClient } from '@ria/db'
import type { SessionData, TenantSummary } from '@ria/core'

// Re-fetches the user's active memberships from the DB and updates the session
// cookie if anything changed. Keeps the session in sync with DB state (role
// changes, disables, new invitations) without requiring re-login.
//
// MUST be called from a Server Action or Route Handler — NOT from a server
// component render. Next.js forbids cookie writes during render; session.save()
// will throw "Cookies can only be modified in a Server Action or Route Handler."
// The caller is (app)/session-refresh-action.ts, triggered by <SessionRefresher>.
//
// Cost: one service-role query per page navigation — acceptable for a B2B app
// where user counts per tenant are small. See PROGRESS.md Part D note.
//
// SERVICE ROLE: cross-tenant membership query (all tenants for this user).
// See SERVICE_ROLE_USAGE.md entry #7.
export async function refreshSessionMemberships(session: IronSession<SessionData>): Promise<void> {
  if (!session.userId) return

  const sr = createServiceRoleClient()
  try {
    const memberships = await sr.tenantMembership.findMany({
      where: { userId: session.userId, status: 'active' },
      include: { tenant: { select: { id: true, name: true, slug: true, status: true } } },
    })

    const freshTenants: TenantSummary[] = memberships
      .filter((m) => m.tenant.status === 'active')
      .map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role as TenantSummary['role'],
      }))

    // Compare sorted snapshots — only save if something changed.
    const key = (t: TenantSummary) => `${t.id}:${t.role}:${t.name}`
    const snapshot = (session.tenants ?? []).map(key).sort().join('|')
    const fresh = freshTenants.map(key).sort().join('|')
    if (snapshot === fresh) return

    session.tenants = freshTenants

    if (session.tenantId) {
      const current = freshTenants.find((t) => t.id === session.tenantId)
      if (current) {
        // Role may have changed.
        session.role = current.role
      } else {
        // Current tenant no longer accessible — clear context.
        // Middleware will redirect the user to /no-access or /switch-tenant.
        session.tenantId = undefined
        session.role = undefined
      }
    }

    await session.save()
  } finally {
    await sr.$disconnect().catch(() => {})
  }
}
