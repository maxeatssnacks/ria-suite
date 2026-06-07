'use server'

import crypto from 'node:crypto'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { getSession } from '@/lib/session'
import type { TenantSummary } from '@ria/core'

export async function acceptInvitation(token: string) {
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

    void writeAuditEvent({
      tenantId: invitation.tenantId,
      actorId: session.userId,
      action: 'invitation.accepted',
      resource: 'invitation',
      resourceId: invitation.id,
      metadata: { role: invitation.role, email: invitation.email },
    })
  } finally {
    await srClient.$disconnect()
  }

  redirect('/dashboard')
}
