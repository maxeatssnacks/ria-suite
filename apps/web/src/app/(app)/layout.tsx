import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'
import { refreshSessionMemberships } from '@/lib/refresh-session'
import { can } from '@ria/core'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  if (!session.userId) {
    redirect('/auth/login')
  }

  // Keep the session's tenant list in sync with the DB.
  // Catches role changes, new memberships, and disables without requiring re-login.
  await refreshSessionMemberships(session)

  const currentTenant = session.tenants?.find((t) => t.id === session.tenantId)
  const isAdmin = can({ role: session.role }, 'membership.change_role')
  const canReadAudit = can({ role: session.role }, 'audit.read')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
          <a href="/dashboard" className="text-sm font-semibold tracking-tight">
            RIA Platform
          </a>
          {currentTenant && (
            <span className="text-muted-foreground text-xs">{currentTenant.name}</span>
          )}
          <div className="flex-1" />
          {(isAdmin || canReadAudit) && (
            <a
              href={isAdmin ? '/admin/users' : '/admin/audit'}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Admin
            </a>
          )}
          {session.role === 'platform_admin' && (
            <a href="/platform" className="text-muted-foreground hover:text-foreground text-xs">
              Platform
            </a>
          )}
          {session.tenants && session.tenants.length > 1 && (
            <a
              href="/switch-tenant"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Switch tenant
            </a>
          )}
          <span className="text-muted-foreground text-xs">{session.name}</span>
          <a href="/auth/logout" className="text-muted-foreground hover:text-foreground text-xs">
            Sign out
          </a>
        </div>
      </header>
      {children}
    </div>
  )
}
