'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { can, TenantSuspendSchema, PlatformModuleActionSchema } from '@ria/core'
import { getSession } from '@/lib/session'

export type PlatformTenantActionState = { error?: string; success?: string }

export async function suspendTenant(
  tenantId: string,
  _prev: PlatformTenantActionState,
  formData: FormData
): Promise<PlatformTenantActionState> {
  const session = await getSession()
  if (!session.userId) redirect('/auth/login')
  if (!can({ role: session.role }, 'platform.tenant_suspend')) return { error: 'Unauthorized.' }

  const parsed = TenantSuspendSchema.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }

  const sr = createServiceRoleClient()
  try {
    await sr.tenant.update({ where: { id: tenantId }, data: { status: 'suspended' } })
  } catch (err) {
    console.error('[platform/tenants] suspendTenant failed', err)
    return { error: 'Failed to suspend tenant.' }
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  writeAuditEvent({
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'platform.tenant_suspend',
    resource: 'tenant',
    resourceId: tenantId,
    metadata: {},
    reason: parsed.data.reason,
  }).catch((err) => console.error('[platform/tenants] audit write failed', err))

  return { success: 'Tenant suspended.' }
}

export async function activateTenant(
  tenantId: string,
  _prev: PlatformTenantActionState,
  formData: FormData
): Promise<PlatformTenantActionState> {
  const session = await getSession()
  if (!session.userId) redirect('/auth/login')
  if (!can({ role: session.role }, 'platform.tenant_activate')) return { error: 'Unauthorized.' }

  const parsed = TenantSuspendSchema.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }

  const sr = createServiceRoleClient()
  try {
    await sr.tenant.update({ where: { id: tenantId }, data: { status: 'active' } })
  } catch (err) {
    console.error('[platform/tenants] activateTenant failed', err)
    return { error: 'Failed to activate tenant.' }
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  writeAuditEvent({
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'platform.tenant_activate',
    resource: 'tenant',
    resourceId: tenantId,
    metadata: {},
    reason: parsed.data.reason,
  }).catch((err) => console.error('[platform/tenants] audit write failed', err))

  return { success: 'Tenant activated.' }
}

export async function platformModuleAction(
  _prev: PlatformTenantActionState,
  formData: FormData
): Promise<PlatformTenantActionState> {
  const session = await getSession()
  if (!session.userId) redirect('/auth/login')

  const parsed = PlatformModuleActionSchema.safeParse({
    tenantId: formData.get('tenantId'),
    moduleId: formData.get('moduleId'),
    action: formData.get('action'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }

  const { tenantId, moduleId, action, reason } = parsed.data
  const permAction =
    action === 'activate' ? 'platform.module_activate' : 'platform.module_deactivate'
  if (!can({ role: session.role }, permAction)) return { error: 'Unauthorized.' }

  const newStatus = action === 'activate' ? 'active' : 'suspended'
  const auditAction =
    action === 'activate' ? 'platform.module_activate' : 'platform.module_deactivate'

  const sr = createServiceRoleClient()
  let moduleRecordId: string
  try {
    const record = await sr.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      create: {
        tenantId,
        moduleId,
        status: newStatus,
        activatedAt: action === 'activate' ? new Date() : null,
      },
      update: {
        status: newStatus,
        ...(action === 'activate' ? { activatedAt: new Date() } : {}),
      },
      select: { id: true },
    })
    moduleRecordId = record.id
  } catch (err) {
    console.error('[platform/tenants] platformModuleAction failed', err)
    return { error: 'Failed to update module status.' }
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  writeAuditEvent({
    tenantId,
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: auditAction,
    resource: 'tenant_module',
    resourceId: moduleRecordId,
    metadata: { moduleId },
    reason,
  }).catch((err) => console.error('[platform/tenants] audit write failed', err))

  return { success: `Module ${action === 'activate' ? 'activated' : 'deactivated'}.` }
}
