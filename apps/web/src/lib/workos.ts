import { WorkOS } from '@workos-inc/node'

// Lazy initialization — WorkOS client is created on first use, not at import time.
// This allows Next.js to import this module during build without WORKOS_API_KEY set.
let _workos: WorkOS | undefined

export function getWorkos(): WorkOS {
  if (!_workos) {
    if (!process.env.WORKOS_API_KEY) throw new Error('WORKOS_API_KEY is not set')
    _workos = new WorkOS(process.env.WORKOS_API_KEY)
  }
  return _workos
}

export const WORKOS_CLIENT_ID = (): string => {
  if (!process.env.WORKOS_CLIENT_ID) throw new Error('WORKOS_CLIENT_ID is not set')
  return process.env.WORKOS_CLIENT_ID
}

export const WORKOS_REDIRECT_URI = (): string =>
  process.env.WORKOS_REDIRECT_URI ?? 'http://localhost:3000/auth/callback'
