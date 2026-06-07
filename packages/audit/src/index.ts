// ─── Interim audit client (Part C) ────────────────────────────────────────────
// Minimal write path using the service-role Prisma client.
// Will be replaced by the full typed audit client in Part E.
//
// SERVICE ROLE USAGE: writes audit_events rows via DIRECT_URL.
// Auth-layer events occur outside forTenant() transactions where
// app_user context is not yet established. See SERVICE_ROLE_USAGE.md entry #4.
//
// IMPORTANT: Never call this from client components. Server-side only.

import { createServiceRoleClient } from '@ria/db'
import type { TenantRole } from '@ria/core'

export type { TenantRole }

export type AuditEventInput = {
  tenantId?: string
  actorId?: string
  actorRole?: TenantRole
  action: string
  resource: string
  resourceId?: string
  // JSON-safe key/value pairs; validated at the boundary before reaching here.
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  reason?: string
}

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  const client = createServiceRoleClient()
  try {
    await client.auditEvent.create({
      data: {
        tenantId: event.tenantId ?? null,
        actorId: event.actorId ?? null,
        // Prisma TenantRole enum — values are identical to our core TenantRole type.
        actorRole: (event.actorRole ?? null) as Parameters<
          typeof client.auditEvent.create
        >[0]['data']['actorRole'],
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId ?? null,
        // Prisma's Json field expects InputJsonValue; cast from our looser Record type.
        metadata: (event.metadata ?? {}) as Parameters<
          typeof client.auditEvent.create
        >[0]['data']['metadata'],
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        reason: event.reason ?? null,
      },
    })
  } finally {
    await client.$disconnect()
  }
}
