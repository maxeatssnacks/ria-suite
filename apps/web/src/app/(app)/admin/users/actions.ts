'use server'

import { redirect } from 'next/navigation'
import { forTenant, createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { can, MemberRoleChangeSchema, MemberDisableSchema } from '@ria/core'
import { getSession } from '@/lib/session'

export type MemberActionState = { error?: string; success?: string }

export async function changeRole(
  _prev: MemberActionState,
  formData: FormData
): Promise<MemberActionState> {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'membership.change_role')) {
    return { error: 'You do not have permission to change roles.' }
  }

  const parsed = MemberRoleChangeSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }

  const { userId, role: newRole } = parsed.data

  if (userId === session.userId) {
    return { error: 'You cannot change your own role.' }
  }

  try {
    const membership = await forTenant(
      session.tenantId,
      async (tx) => {
        const existing = await tx.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: session.tenantId!, userId } },
        })
        if (!existing) return null

        return tx.tenantMembership.update({
          where: { tenantId_userId: { tenantId: session.tenantId!, userId } },
          data: { role: newRole },
          select: { role: true },
        })
      },
      { userId: session.userId }
    )

    if (!membership) return { error: 'Member not found.' }

    writeAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
      action: 'membership.change_role',
      resource: 'tenant_membership',
      resourceId: userId,
      metadata: { newRole },
    }).catch((err) => console.error('[admin/users] audit write failed', err))

    return { success: 'Role updated.' }
  } catch (err) {
    console.error('[admin/users] changeRole failed', err)
    return { error: 'Failed to update role. Please try again.' }
  }
}

export async function disableMember(
  _prev: MemberActionState,
  formData: FormData
): Promise<MemberActionState> {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'membership.disable')) {
    return { error: 'You do not have permission to disable members.' }
  }

  const parsed = MemberDisableSchema.safeParse({ userId: formData.get('userId') })
  if (!parsed.success) return { error: 'Invalid input.' }

  const { userId } = parsed.data

  if (userId === session.userId) {
    return { error: 'You cannot disable your own membership.' }
  }

  try {
    const updated = await forTenant(
      session.tenantId,
      async (tx) => {
        const existing = await tx.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: session.tenantId!, userId } },
        })
        if (!existing) return null

        return tx.tenantMembership.update({
          where: { tenantId_userId: { tenantId: session.tenantId!, userId } },
          data: { status: 'disabled' },
          select: { id: true },
        })
      },
      { userId: session.userId }
    )

    if (!updated) return { error: 'Member not found.' }

    writeAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
      action: 'membership.disable',
      resource: 'tenant_membership',
      resourceId: userId,
      metadata: {},
    }).catch((err) => console.error('[admin/users] audit write failed', err))

    return { success: 'Member disabled.' }
  } catch (err) {
    console.error('[admin/users] disableMember failed', err)
    return { error: 'Failed to disable member. Please try again.' }
  }
}

export async function reenableMember(
  _prev: MemberActionState,
  formData: FormData
): Promise<MemberActionState> {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'membership.disable')) {
    return { error: 'You do not have permission to re-enable members.' }
  }

  const parsed = MemberDisableSchema.safeParse({ userId: formData.get('userId') })
  if (!parsed.success) return { error: 'Invalid input.' }

  const { userId } = parsed.data

  try {
    const sr = createServiceRoleClient()
    try {
      // Re-enabling uses service role — the disabled membership fails the
      // app_user INSERT/UPDATE policy (status check). We re-enable as platform op.
      await sr.tenantMembership.update({
        where: { tenantId_userId: { tenantId: session.tenantId, userId } },
        data: { status: 'active' },
      })
    } finally {
      await sr.$disconnect().catch(() => {})
    }

    writeAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
      action: 'membership.reenable',
      resource: 'tenant_membership',
      resourceId: userId,
      metadata: {},
    }).catch((err) => console.error('[admin/users] audit write failed', err))

    return { success: 'Member re-enabled.' }
  } catch (err) {
    console.error('[admin/users] reenableMember failed', err)
    return { error: 'Failed to re-enable member. Please try again.' }
  }
}
