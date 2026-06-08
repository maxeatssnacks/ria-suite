import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { SuspendTenantForm, ActivateTenantForm, ModuleActionForm } from './tenant-actions'

interface Props {
  params: Promise<{ tenantId: string }>
}

const TENANT_MODULE_STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-green-100 text-green-700' },
  trial: { label: 'Trial', classes: 'bg-blue-100 text-blue-700' },
  suspended: { label: 'Suspended', classes: 'bg-gray-100 text-gray-600' },
}

export default async function PlatformTenantDetailPage({ params }: Props) {
  const { tenantId } = await params

  const sr = createServiceRoleClient()
  let tenant
  let allModules
  try {
    tenant = await sr.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        memberships: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { role: 'asc' },
        },
        tenantModules: {
          include: { module: { select: { id: true, name: true, key: true } } },
          orderBy: { module: { name: 'asc' } },
        },
      },
    })
    allModules = await sr.module.findMany({
      where: { status: { not: 'deprecated' } },
      orderBy: { name: 'asc' },
    })
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  if (!tenant) notFound()

  const activeModuleIds = new Set(tenant.tenantModules.map((tm) => tm.moduleId))
  const inactiveModules = allModules.filter((m) => !activeModuleIds.has(m.id))

  return (
    <div className="space-y-8">
      <div>
        <a href="/platform" className="text-muted-foreground text-sm hover:underline">
          ← Tenants
        </a>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{tenant.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{tenant.slug}</p>
          </div>
          <div className="text-right">
            <div className="text-sm">
              Status: <strong>{tenant.status}</strong>
            </div>
            <div className="text-muted-foreground text-xs">
              Tier: {tenant.isolationTier.replace(/_/g, ' ')} · Created{' '}
              {tenant.createdAt.toISOString().slice(0, 10)}
            </div>
          </div>
        </div>
      </div>

      {/* Suspend / Activate */}
      <section>
        <h2 className="mb-3 font-semibold">Tenant status</h2>
        {tenant.status === 'active' || tenant.status === 'trial' ? (
          <SuspendTenantForm tenantId={tenantId} />
        ) : (
          <ActivateTenantForm tenantId={tenantId} />
        )}
      </section>

      {/* Members (read-only) */}
      <section>
        <h2 className="mb-3 font-semibold">Members ({tenant.memberships.length})</h2>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenant.memberships.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">{m.user.name}</td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">{m.user.email}</td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    {m.role.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{m.status}</td>
                </tr>
              ))}
              {tenant.memberships.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-4 text-center text-sm">
                    No members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active modules */}
      <section>
        <h2 className="mb-3 font-semibold">Active modules</h2>
        {tenant.tenantModules.length > 0 ? (
          <div className="space-y-2">
            {tenant.tenantModules.map((tm) => {
              const statusInfo =
                TENANT_MODULE_STATUS_LABEL[tm.status] ?? TENANT_MODULE_STATUS_LABEL.suspended
              return (
                <div
                  key={tm.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{tm.module.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusInfo.classes}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  {tm.status !== 'suspended' && (
                    <ModuleActionForm
                      tenantId={tenantId}
                      moduleId={tm.module.id}
                      moduleName={tm.module.name}
                      currentAction="deactivate"
                    />
                  )}
                  {tm.status === 'suspended' && (
                    <ModuleActionForm
                      tenantId={tenantId}
                      moduleId={tm.module.id}
                      moduleName={tm.module.name}
                      currentAction="activate"
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No modules activated.</p>
        )}
      </section>

      {/* Inactive modules — can be activated */}
      {inactiveModules.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Available to activate</h2>
          <div className="space-y-2">
            {inactiveModules.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium text-sm">{mod.name}</span>
                <ModuleActionForm
                  tenantId={tenantId}
                  moduleId={mod.id}
                  moduleName={mod.name}
                  currentAction="activate"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
