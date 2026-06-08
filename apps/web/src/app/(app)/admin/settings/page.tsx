import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { can, TenantSettingsJsonSchema } from '@ria/core'
import { getSession } from '@/lib/session'
import { SettingsForm } from './settings-form'
import type { Prisma } from '@prisma/client'

export default async function AdminSettingsPage() {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'tenant.update_settings')) redirect('/dashboard')

  const sr = createServiceRoleClient()
  let tenant
  try {
    tenant = await sr.tenant.findUnique({ where: { id: session.tenantId } })
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  if (!tenant) redirect('/dashboard')

  const settings = TenantSettingsJsonSchema.parse(tenant.settings as Prisma.JsonValue)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Manage your firm&apos;s name, timezone, and notification preferences.
        </p>
      </div>

      <div className="max-w-2xl">
        <SettingsForm
          name={tenant.name}
          timezone={tenant.timezone}
          notificationEmail={settings.notificationEmail}
          notifyOnLogin={settings.notifyOnLogin}
          notifyOnAdminAction={settings.notifyOnAdminAction}
        />
      </div>
    </div>
  )
}
