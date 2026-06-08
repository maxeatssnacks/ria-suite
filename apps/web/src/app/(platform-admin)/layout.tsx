import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  if (!session.userId) redirect('/auth/login')
  if (session.role !== 'platform_admin') {
    // Authenticated but not platform_admin — send them to the tenant app.
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-slate-900 text-white">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
          <a href="/platform" className="text-sm font-semibold tracking-tight">
            RIA Platform Admin
          </a>
          <div className="flex-1" />
          <a href="/platform" className="text-sm text-slate-300 hover:text-white">
            Tenants
          </a>
          <span className="text-sm text-slate-400">{session.name}</span>
          <a href="/auth/logout" className="text-sm text-slate-300 hover:text-white">
            Sign out
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
