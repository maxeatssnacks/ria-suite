import type { IronSession } from 'iron-session'
import { createServiceRoleClient } from '@ria/db'
import type { SessionData, TenantSummary } from '@ria/core'

// Re-fetches the user's active memberships from the DB on every page navigation
// through (app)/layout.tsx. This is the chosen mechanism for keeping the session
// fresh after role changes, new invitations accepted, or membership status changes.
//
// Cost: one service-role query per page navigation — acceptable for a B2B app
// where user counts per tenant are small and correctness matters more than
// eliminating a single round-trip. See PROGRESS.md Part D session-refresh note.
//
// SERVICE ROLE: reading memberships cross-tenant (we need all tenants for this
// user, not just the current one). See SERVICE_ROLE_USAGE.md entry #7.
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
