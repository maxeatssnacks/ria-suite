'use server'

import { redirect } from 'next/navigation'
import { writeAuditEvent } from '@ria/audit'
import { can } from '@ria/core'
import { getSession } from '@/lib/session'

export type ModuleActionState = { error?: string; success?: string }

export async function requestModuleActivation(
  _prev: ModuleActionState,
  formData: FormData
): Promise<ModuleActionState> {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'module.request_activation')) {
    return { error: 'You do not have permission to request module activation.' }
  }

  const moduleId = String(formData.get('moduleId') ?? '')
  const moduleName = String(formData.get('moduleName') ?? '')
  if (!moduleId) return { error: 'Module ID is required.' }

  // Activation is performed by platform_admin; this records the request.
  // The audit event is the request record. Platform admins see it in the audit log
  // and activate via the platform console.
  writeAuditEvent({
    tenantId: session.tenantId,
    actorId: session.userId,
    actorRole: session.role as Parameters<typeof writeAuditEvent>[0]['actorRole'],
    action: 'module.activation_requested',
    resource: 'module',
    resourceId: moduleId,
    metadata: { moduleName },
  }).catch((err) => console.error('[admin/modules] audit write failed', err))

  return {
    success: `Activation request for "${moduleName}" submitted. Our team will review and activate it shortly.`,
  }
}
