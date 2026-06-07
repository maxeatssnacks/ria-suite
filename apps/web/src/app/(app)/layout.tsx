import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  // Middleware handles the primary auth redirect, but we double-check here as
  // a defence-in-depth measure (middleware can be bypassed in some edge cases).
  if (!session.userId) {
    redirect('/auth/login')
  }

  return <>{children}</>
}
