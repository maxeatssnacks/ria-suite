import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { can } from '@ria/core'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session.tenantId) {
    redirect(session.tenants.length > 1 ? '/switch-tenant' : '/no-access')
  }

  const currentTenant = session.tenants.find((t) => t.id === session.tenantId)
  const isAdmin = can({ role: session.role }, 'membership.change_role')
  const canReadAudit = can({ role: session.role }, 'audit.read')

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{currentTenant?.name}</h1>
        <p className="text-muted-foreground text-sm">{session.role?.replace(/_/g, ' ')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAdmin && (
          <a
            href="/admin/users"
            className="hover:bg-accent rounded-lg border p-4 transition-colors"
          >
            <h2 className="font-semibold">Users &amp; Roles</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage team members, roles, and invitations
            </p>
          </a>
        )}
        {isAdmin && (
          <a
            href="/admin/modules"
            className="hover:bg-accent rounded-lg border p-4 transition-colors"
          >
            <h2 className="font-semibold">Modules</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              View and request activation of compliance modules
            </p>
          </a>
        )}
        {canReadAudit && (
          <a
            href="/admin/audit"
            className="hover:bg-accent rounded-lg border p-4 transition-colors"
          >
            <h2 className="font-semibold">Audit Log</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Review all platform activity for your firm
            </p>
          </a>
        )}
        {isAdmin && (
          <a
            href="/admin/settings"
            className="hover:bg-accent rounded-lg border p-4 transition-colors"
          >
            <h2 className="font-semibold">Settings</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tenant name, timezone, and notification preferences
            </p>
          </a>
        )}
        {isAdmin && (
          <a
            href="/admin/integrations"
            className="hover:bg-accent rounded-lg border p-4 transition-colors"
          >
            <h2 className="font-semibold">Integrations</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Connect third-party services and data sources
            </p>
          </a>
        )}
      </div>
    </main>
  )
}
