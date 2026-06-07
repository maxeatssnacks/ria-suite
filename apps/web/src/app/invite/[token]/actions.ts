'use server'

import crypto from 'node:crypto'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { getSession } from '@/lib/session'
import type { TenantSummary } from '@ria/core'

// State returned to the invite page when the accept flow does NOT redirect.
// A successful accept ends in redirect('/dashboard') and never returns a value.
export type AcceptInvitationState = { error?: string }

export async function acceptInvitation(
  token: string,
  _prevState: AcceptInvitationState,
  _formData: FormData
): Promise<AcceptInvitationState> {
  const session = await getSession()
  if (!session.userId) {
    redirect(`/auth/login?redirect=/invite/${token}`)
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const srClient = createServiceRoleClient()
  try {
    // SERVICE ROLE: look up invitation by token hash without tenant context.
    // See SERVICE_ROLE_USAGE.md entry #6.
    const invitation = await srClient.invitation.findUnique({
      where: { tokenHash },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    })

    if (!invitation) {
      return { error: 'Invitation not found or already used.' }
    }
    if (invitation.acceptedAt) {
      return { error: 'This invitation has already been accepted.' }
    }
    if (invitation.expiresAt < new Date()) {
      return { error: 'This invitation has expired. Ask your administrator to resend it.' }
    }
    if (invitation.email.toLowerCase() !== session.email.toLowerCase()) {
      return { error: 'This invitation was sent to a different email address.' }
    }

    // Check for existing membership (idempotency guard).
    const existing = await srClient.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: invitation.tenantId, userId: session.userId } },
    })
    if (existing) {
      return { error: 'You are already a member of this tenant.' }
    }

    // Create membership and mark invitation accepted in a transaction.
    await srClient.$transaction([
      srClient.tenantMembership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: session.userId,
          role: invitation.role,
          status: 'active',
        },
      }),
      srClient.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ])

    // Add the new tenant to the session.
    const newTenant: TenantSummary = {
      id: invitation.tenant.id,
      name: invitation.tenant.name,
      slug: invitation.tenant.slug,
      role: invitation.role as TenantSummary['role'],
    }
    const existingTenants = session.tenants ?? []
    session.tenants = [...existingTenants.filter((t) => t.id !== newTenant.id), newTenant]
    session.tenantId = newTenant.id
    session.role = newTenant.role
    await session.save()

    // Fire-and-forget, but it MUST catch its own rejection — an unhandled
    // rejection here can crash the dev server process.
    writeAuditEvent({
      tenantId: invitation.tenantId,
      actorId: session.userId,
      action: 'invitation.accepted',
      resource: 'invitation',
      resourceId: invitation.id,
      metadata: { role: invitation.role, email: invitation.email },
    }).catch((err) => {
      console.error('[invite] audit write failed for invitation.accepted', err)
    })
  } catch (err) {
    // Any thrown error (DB unreachable, Prisma resolution, etc.) is logged
    // server-side and surfaced to the user instead of a silent 200.
    console.error('[invite] acceptInvitation failed', err)
    return {
      error:
        'Something went wrong accepting this invitation. Please try again, or contact your administrator if it keeps happening.',
    }
  } finally {
    await srClient.$disconnect().catch(() => {})
  }

  // Outside the try/catch: redirect() throws a NEXT_REDIRECT control-flow signal
  // that must propagate, not be swallowed by the catch above.
  redirect('/dashboard')
}
