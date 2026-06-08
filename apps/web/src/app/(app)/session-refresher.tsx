'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { refreshSession } from './session-refresh-action'

// Fires on every client-side navigation (usePathname dependency) to keep the
// session cookie in sync with DB membership state. Uses a Server Action so the
// cookie write happens in an allowed context — layout render is forbidden from
// calling session.save(). The layout renders with the current cookie; the
// action fires after mount, and the next navigation sees the updated session.
export function SessionRefresher() {
  const pathname = usePathname()

  useEffect(() => {
    refreshSession().catch(() => {})
  }, [pathname])

  return null
}
