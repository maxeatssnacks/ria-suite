'use server'

// Must live in a server action file — cookie writes (session.save) are only
// allowed in Server Actions and Route Handlers, not during layout render.
import { getSession } from '@/lib/session'
import { refreshSessionMemberships } from '@/lib/refresh-session'

export async function refreshSession(): Promise<void> {
  const session = await getSession()
  await refreshSessionMemberships(session)
}
