import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { Resend } from 'resend'
import { forTenant } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { InvitationCreateSchema, can } from '@ria/core'
import { getSessionUser } from '@/lib/session'

let _resend: Resend | undefined
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function getFromAddress() {
  return process.env.RESEND_FROM_ADDRESS ?? 'noreply@ria.example.com'
}
function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser()
  if (!session?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!can({ role: session.role }, 'invitation.send')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = InvitationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, role } = parsed.data

  // Tokens are 32 random bytes; only the SHA-256 hash is stored.
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  let invitation
  try {
    invitation = await forTenant(
      session.tenantId,
      async (tx) => {
        return tx.invitation.create({
          data: {
            tenantId: session.tenantId!,
            email,
            role,
            tokenHash,
            expiresAt,
            createdBy: session.userId,
          },
          include: { tenant: { select: { name: true } } },
        })
      },
      { userId: session.userId }
    )
  } catch (err) {
    console.error('[invitations] DB error:', err)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  // Send invitation email.
  const acceptUrl = `${getAppUrl()}/invite/${token}`
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback: log the accept URL so the flow is testable without Resend.
    // Resend is wired for real in Part F.
    console.log(`[invitations] DEV — no RESEND_API_KEY set. Accept URL:\n  ${acceptUrl}`)
  } else {
    try {
      await getResend().emails.send({
        from: getFromAddress(),
        to: email,
        subject: `You've been invited to ${invitation.tenant.name} on RIA`,
        html: `
        <p>You've been invited to join <strong>${invitation.tenant.name}</strong> as <strong>${role.replace(/_/g, ' ')}</strong>.</p>
        <p><a href="${acceptUrl}">Accept your invitation</a> — link expires in 7 days.</p>
        <p style="color:#666;font-size:12px">If you weren't expecting this, you can ignore this email.</p>
      `,
      })
    } catch (err) {
      console.error('[invitations] Email error:', err)
      // Don't fail the request — the invitation row exists; admin can resend.
    }
  }

  void writeAuditEvent({
    tenantId: session.tenantId,
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'invitation.sent',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: { email, role },
    ipAddress:
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ id: invitation.id }, { status: 201 })
}
