import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session.tenantId) {
    redirect(session.tenants.length > 1 ? '/switch-tenant' : '/no-access')
  }

  const currentTenant = session.tenants.find((t) => t.id === session.tenantId)

  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{currentTenant?.name}</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {session.name} &middot; {session.role?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex gap-3">
          {session.tenants.length > 1 && (
            <a
              href="/switch-tenant"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Switch tenant
            </a>
          )}
          <a href="/auth/logout" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            Sign out
          </a>
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="mb-2 font-semibold">Platform shell</h2>
        <p className="text-muted-foreground text-sm">
          Modules will appear here as they are activated. This is Part C of the RIA platform build.
        </p>
      </div>
    </main>
  )
}
