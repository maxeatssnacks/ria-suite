import { getSession } from '@/lib/session'
import { switchTenant } from './actions'

export default async function SwitchTenantPage() {
  const session = await getSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">Select a tenant</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          You have access to multiple firms. Choose one to continue.
        </p>

        <ul className="space-y-2">
          {session.tenants.map((tenant) => (
            <li key={tenant.id}>
              <form action={switchTenant}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <button
                  type="submit"
                  className="hover:bg-accent flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors"
                >
                  <span className="font-medium">{tenant.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {tenant.role.replace(/_/g, ' ')}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>

        <div className="mt-6 text-center">
          <a href="/auth/logout" className="text-muted-foreground text-sm underline">
            Sign out
          </a>
        </div>
      </div>
    </main>
  )
}
