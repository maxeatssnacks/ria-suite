import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@ria/core'

// Options built lazily so SESSION_SECRET is read at call time (not import time),
// allowing Next.js static analysis to import this module during build.
function getSessionOptions(): SessionOptions {
  return {
    password: process.env.SESSION_SECRET ?? '',
    cookieName: 'ria-session',
    ttl: 60 * 60 * 24 * 7, // 7 days
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  }
}

export type { SessionData }

/**
 * Read/write the session from Next.js server components and server actions.
 * Uses cookies() from next/headers — not usable in route handlers or middleware.
 * Call session.save() after mutating to persist changes.
 */
export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

/**
 * Read the session and return it as a typed value, or null if unauthenticated.
 * Use in server components that handle the unauthenticated case themselves.
 */
export async function getSessionUser(): Promise<SessionData | null> {
  const session = await getSession()
  if (!session.userId) return null
  return session as SessionData
}
