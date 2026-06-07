import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession, type SessionOptions } from 'iron-session'
import { createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import type { TenantSummary, SessionData } from '@ria/core'
import { getWorkos, WORKOS_CLIENT_ID } from '@/lib/workos'

// Decode the `sid` claim from a WorkOS access token JWT without verifying the
// signature — we trust it because we just received it from WorkOS directly.
function extractSid(accessToken: string): string | undefined {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return undefined
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<
      string,
      unknown
    >
    return typeof decoded.sid === 'string' ? decoded.sid : undefined
  } catch {
    return undefined
  }
}

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  try {
    // Exchange WorkOS authorization code for user identity.
    const { user: workosUser, accessToken } = await getWorkos().userManagement.authenticateWithCode(
      {
        clientId: WORKOS_CLIENT_ID(),
        code,
      }
    )

    // Extract WorkOS session ID from the `sid` JWT claim. Stored in our session
    // so logout can call getLogoutUrl() to terminate the IdP session.
    const workosSessionId = extractSid(accessToken)

    const srClient = createServiceRoleClient()
    let dbUser: { id: string; name: string }
    let tenants: TenantSummary[]

    try {
      // JIT provision: upsert user row keyed by WorkOS user ID.
      dbUser = await srClient.user.upsert({
        where: { workosUserId: workosUser.id },
        create: {
          workosUserId: workosUser.id,
          email: workosUser.email,
          name:
            [workosUser.firstName, workosUser.lastName].filter(Boolean).join(' ') ||
            workosUser.email,
        },
        update: {
          email: workosUser.email,
          name:
            [workosUser.firstName, workosUser.lastName].filter(Boolean).join(' ') ||
            workosUser.email,
        },
      })

      // Load all active tenant memberships for session caching.
      // SERVICE ROLE: cross-tenant list needed at login time.
      // See SERVICE_ROLE_USAGE.md entry #5.
      const memberships = await srClient.tenantMembership.findMany({
        where: { userId: dbUser.id, status: 'active' },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      })

      tenants = memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role as TenantSummary['role'],
      }))
    } finally {
      await srClient.$disconnect()
    }

    const activeTenant = tenants.length === 1 ? tenants[0] : undefined
    const postLoginDest = typeof state === 'string' && state.startsWith('/') ? state : '/dashboard'
    const redirectTo =
      tenants.length === 0 ? '/no-access' : tenants.length > 1 ? '/switch-tenant' : postLoginDest

    const response = NextResponse.redirect(new URL(redirectTo, request.url))

    // Write session onto the redirect response so Set-Cookie is sent.
    const session = await getIronSession<SessionData>(request, response, getSessionOptions())
    session.userId = dbUser.id
    session.workosUserId = workosUser.id
    session.workosSessionId = workosSessionId
    session.email = workosUser.email
    session.name = dbUser.name
    session.tenants = tenants
    if (activeTenant) {
      session.tenantId = activeTenant.id
      session.role = activeTenant.role
    }
    await session.save()

    void writeAuditEvent({
      tenantId: activeTenant?.id,
      actorId: dbUser.id,
      actorRole: activeTenant?.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
      action: 'user.login',
      resource: 'user',
      resourceId: dbUser.id,
      ipAddress:
        request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return response
  } catch (err) {
    console.error('[auth/callback] error:', err)
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}
