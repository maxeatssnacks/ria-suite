import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'
import { can } from '@ria/core'

const ADMIN_NAV = [
  { href: '/admin/users', label: 'Users & Roles', action: 'membership.change_role' },
  { href: '/admin/modules', label: 'Modules', action: 'module.request_activation' },
  { href: '/admin/settings', label: 'Settings', action: 'tenant.update_settings' },
  { href: '/admin/audit', label: 'Audit Log', action: 'audit.read' },
  { href: '/admin/integrations', label: 'Integrations', action: 'membership.change_role' },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  if (!session.userId) redirect('/auth/login')

  const isAdmin = can({ role: session.role }, 'membership.change_role')
  const canReadAudit = can({ role: session.role }, 'audit.read')

  if (!isAdmin && !canReadAudit) {
    redirect('/dashboard')
  }

  const visibleNav = ADMIN_NAV.filter((item) => can({ role: session.role }, item.action))

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8">
      <aside className="w-44 shrink-0">
        <nav className="flex flex-col gap-0.5">
          {visibleNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
