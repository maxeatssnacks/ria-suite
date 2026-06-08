'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { can, TenantSettingsUpdateSchema, TenantSettingsJsonSchema } from '@ria/core'
import { getSession } from '@/lib/session'
import type { Prisma } from '@prisma/client'

export type SettingsState = { error?: string; success?: string }

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'tenant.update_settings')) {
    return { error: 'You do not have permission to update settings.' }
  }

  const parsed = TenantSettingsUpdateSchema.safeParse({
    name: formData.get('name'),
    timezone: formData.get('timezone'),
    notificationEmail: formData.get('notificationEmail') ?? undefined,
    notifyOnLogin: formData.get('notifyOnLogin') === 'on',
    notifyOnAdminAction: formData.get('notifyOnAdminAction') === 'on',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { name, timezone, notificationEmail, notifyOnLogin, notifyOnAdminAction } = parsed.data

  // SERVICE ROLE: tenants table only grants SELECT to app_user.
  // See SERVICE_ROLE_USAGE.md entry #8.
  const sr = createServiceRoleClient()
  try {
    const current = await sr.tenant.findUnique({ where: { id: session.tenantId } })
    if (!current) return { error: 'Tenant not found.' }

    const existing = TenantSettingsJsonSchema.parse(current.settings as Prisma.JsonValue)
    const newSettings = {
      ...existing,
      notificationEmail: notificationEmail ?? existing.notificationEmail ?? null,
      notifyOnLogin: notifyOnLogin ?? existing.notifyOnLogin ?? false,
      notifyOnAdminAction: notifyOnAdminAction ?? existing.notifyOnAdminAction ?? true,
    }

    await sr.tenant.update({
      where: { id: session.tenantId },
      data: { name, timezone, settings: newSettings },
    })
  } catch (err) {
    console.error('[admin/settings] updateSettings failed', err)
    return { error: 'Failed to save settings. Please try again.' }
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  writeAuditEvent({
    tenantId: session.tenantId,
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'tenant.update_settings',
    resource: 'tenant',
    resourceId: session.tenantId,
    metadata: { name, timezone },
  }).catch((err) => console.error('[admin/settings] audit write failed', err))

  return { success: 'Settings saved.' }
}
