import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession, type SessionOptions } from 'iron-session'
import { writeAuditEvent } from '@ria/audit'
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
  const response = NextResponse.redirect(new URL('/auth/login', request.url))
  const session = await getIronSession<SessionData>(request, response, getSessionOptions())

  // Capture identity before destroying for audit log.
  const { userId, tenantId, role } = session

  session.destroy()

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
