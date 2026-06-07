import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession, type SessionOptions } from 'iron-session'
import { writeAuditEvent } from '@ria/audit'
import { getWorkos } from '@/lib/workos'
import type { SessionData } from '@ria/core'

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
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const signedOutUrl = `${appBaseUrl}/auth/signed-out`

  // Use a temporary Response for iron-session to write the cookie-clearing
  // Set-Cookie header onto. We determine the redirect target first, then
  // transfer the header to the final redirect response.
  const cookieSink = new Response()
  const session = await getIronSession<SessionData>(request, cookieSink, getSessionOptions())

  const { userId, tenantId, role, workosSessionId } = session
  session.destroy()

  // Redirect through WorkOS's logout endpoint to terminate the IdP session.
  // Without this, WorkOS silently re-authenticates on next login attempt.
  const redirectTarget = workosSessionId
    ? getWorkos().userManagement.getLogoutUrl({
        sessionId: workosSessionId,
        returnTo: signedOutUrl,
      })
    : signedOutUrl

  const response = NextResponse.redirect(redirectTarget)

  // Transfer the session-clearing Set-Cookie header to the final response.
  for (const cookie of cookieSink.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookie)
  }

  if (userId) {
    void writeAuditEvent({
      tenantId,
      actorId: userId,
      actorRole: role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
      action: 'user.logout',
      resource: 'user',
      resourceId: userId,
      ipAddress:
        request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })
  }

  return response
}
