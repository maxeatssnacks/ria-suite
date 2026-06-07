'use server'

import { redirect } from 'next/navigation'
import { writeAuditEvent } from '@ria/audit'
import { SwitchTenantSchema } from '@ria/core'
import { getSession } from '@/lib/session'

export async function switchTenant(formData: FormData) {
  const session = await getSession()
  if (!session.userId) redirect('/auth/login')

  const parsed = SwitchTenantSchema.safeParse({ tenantId: formData.get('tenantId') })
  if (!parsed.success) return

  const { tenantId } = parsed.data

  // Verify the requested tenant is in the user's pre-loaded tenant list.
  const target = session.tenants.find((t) => t.id === tenantId)
  if (!target) return // not a member — ignore silently (don't leak existence)

  const previousTenantId = session.tenantId

  session.tenantId = target.id
  session.role = target.role
  await session.save()

  writeAuditEvent({
    tenantId: target.id,
    actorId: session.userId,
    actorRole: target.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'tenant.switched',
    resource: 'tenant',
    resourceId: target.id,
    metadata: { from: previousTenantId ?? null, to: target.id },
  }).catch((err) => {
    console.error('[switch-tenant] audit write failed for tenant.switched', err)
  })

  redirect('/dashboard')
}
