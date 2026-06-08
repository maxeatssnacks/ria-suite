'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { writeAuditEvent } from '@ria/audit'
import { can, TenantCreateSchema } from '@ria/core'
import { getSession } from '@/lib/session'

export type CreateTenantState = { error?: string; fieldErrors?: Record<string, string> }

export async function createTenant(
  _prev: CreateTenantState,
  formData: FormData
): Promise<CreateTenantState> {
  const session = await getSession()
  if (!session.userId) redirect('/auth/login')
  if (!can({ role: session.role }, 'platform.tenant_create')) {
    return { error: 'Unauthorized.' }
  }

  const parsed = TenantCreateSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    isolationTier: formData.get('isolationTier'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() ?? 'root'
      fieldErrors[field] = issue.message
    }
    return { fieldErrors }
  }

  const { name, slug, isolationTier, reason } = parsed.data

  const sr = createServiceRoleClient()
  let newTenantId: string
  try {
    const existing = await sr.tenant.findUnique({ where: { slug } })
    if (existing) return { fieldErrors: { slug: 'This slug is already taken.' } }

    const tenant = await sr.tenant.create({
      data: { name, slug, status: 'active', isolationTier },
      select: { id: true },
    })
    newTenantId = tenant.id
  } catch (err) {
    console.error('[platform/tenants/new] createTenant failed', err)
    return { error: 'Failed to create tenant. Please try again.' }
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  writeAuditEvent({
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'platform.tenant_create',
    resource: 'tenant',
    resourceId: newTenantId,
    metadata: { name, slug, isolationTier },
    reason,
  }).catch((err) => console.error('[platform/tenants/new] audit write failed', err))

  redirect(`/platform/tenants/${newTenantId}`)
}
