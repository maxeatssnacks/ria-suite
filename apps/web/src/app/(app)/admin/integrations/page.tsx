import { redirect } from 'next/navigation'
import { can } from '@ria/core'
import { getSession } from '@/lib/session'

// Placeholder establishing the integration pattern for future modules.
// No real integrations are connected in Part D; wiring happens per-module.

const INTEGRATIONS = [
  {
    id: 'dtcc',
    name: 'DTCC / NSCC',
    description: 'Account transfer (ACAT) data for restricted securities screening.',
    status: 'coming_soon',
  },
  {
    id: 'custodian',
    name: 'Custodian Feed',
    description: 'Automated position and transaction feeds from supported custodians.',
    status: 'coming_soon',
  },
  {
    id: 'crm',
    name: 'CRM / Portfolio System',
    description: 'Sync client accounts and representative assignments.',
    status: 'coming_soon',
  },
]

export default async function AdminIntegrationsPage() {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'membership.change_role')) redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Connect external data sources and services to power your compliance modules.
        </p>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <div className="font-medium">{integration.name}</div>
              <p className="text-muted-foreground mt-0.5 text-sm">{integration.description}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
              Coming soon
            </span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        Need a specific integration? Contact{' '}
        <a href="mailto:support@ria.platform" className="underline">
          support@ria.platform
        </a>
        .
      </p>
    </div>
  )
}
