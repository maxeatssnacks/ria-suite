import { redirect } from 'next/navigation'
import { forTenant, createServiceRoleClient } from '@ria/db'
import { can } from '@ria/core'
import { getSession } from '@/lib/session'
import { RequestActivationForm } from './request-form'

const MODULE_STATUS_LABEL: Record<string, string> = {
  alpha: 'Alpha',
  beta: 'Beta',
  ga: 'Generally Available',
  deprecated: 'Deprecated',
}

const TENANT_MODULE_STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-green-100 text-green-700' },
  trial: { label: 'Trial', classes: 'bg-blue-100 text-blue-700' },
  suspended: { label: 'Suspended', classes: 'bg-gray-100 text-gray-600' },
}

export default async function AdminModulesPage() {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'module.request_activation')) redirect('/dashboard')

  // Load all non-deprecated modules from the catalog (service role — global catalog).
  const sr = createServiceRoleClient()
  let allModules
  try {
    allModules = await sr.module.findMany({
      where: { status: { not: 'deprecated' } },
      orderBy: { name: 'asc' },
    })
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  // Load tenant's active module subscriptions within RLS.
  const tenantModules = await forTenant(session.tenantId, async (tx) => {
    return tx.tenantModule.findMany({ where: { tenantId: session.tenantId! } })
  })

  const tenantModuleByModuleId = new Map(tenantModules.map((tm) => [tm.moduleId, tm]))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Modules</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Compliance and operations modules available for your firm. Activation requests are
          reviewed by the RIA Platform team.
        </p>
      </div>

      <div className="space-y-3">
        {allModules.map((mod) => {
          const subscription = tenantModuleByModuleId.get(mod.id)
          const statusInfo = subscription
            ? (TENANT_MODULE_STATUS_LABEL[subscription.status] ??
              TENANT_MODULE_STATUS_LABEL.suspended)
            : null

          return (
            <div key={mod.id} className="flex items-start justify-between rounded-lg border p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{mod.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {MODULE_STATUS_LABEL[mod.status] ?? mod.status}
                  </span>
                  {statusInfo && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusInfo.classes}`}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>
                {mod.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{mod.description}</p>
                )}
              </div>
              <div className="ml-4 shrink-0">
                {!subscription ? (
                  <RequestActivationForm moduleId={mod.id} moduleName={mod.name} />
                ) : subscription.status === 'suspended' ? (
                  <RequestActivationForm moduleId={mod.id} moduleName={mod.name} />
                ) : (
                  <span className="text-muted-foreground text-xs">Managed by platform team</span>
                )}
              </div>
            </div>
          )
        })}
        {allModules.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No modules available yet.
          </p>
        )}
      </div>
    </div>
  )
}
