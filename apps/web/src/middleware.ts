import { getIronSession, type SessionOptions } from 'iron-session'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SessionData } from '@ria/core'

// Built lazily so process.env is read at runtime, not at import/build time.
function getSessionOptions(): SessionOptions {
  return {
    password: process.env.SESSION_SECRET ?? '',
    cookieName: 'ria-session',
    ttl: 60 * 60 * 24 * 7,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  }
}

const PUBLIC_PREFIXES = ['/auth/', '/invite/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Read the session from the request. We don't call session.save(), so the
  // dummy Response receives no Set-Cookie headers and is discarded.
  const dummy = new Response()
  const session = await getIronSession<SessionData>(request, dummy, getSessionOptions())

  if (!session.userId) {
    const loginUrl = new URL('/auth/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (!session.tenantId && pathname !== '/no-access' && pathname !== '/switch-tenant') {
    const dest = session.tenants && session.tenants.length > 1 ? '/switch-tenant' : '/no-access'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
