import { type NextRequest, NextResponse } from 'next/server'
import { forTenant, createServiceRoleClient } from '@ria/db'
import { can } from '@ria/core'
import { getSessionUser } from '@/lib/session'

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  // RFC 4180: wrap in double quotes, escape inner double quotes by doubling.
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',')
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  if (!session?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!can({ role: session.role }, 'audit.export')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''
  const actionFilter = sp.get('action') ?? ''

  const where = {
    tenantId: session.tenantId,
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}),
          },
        }
      : {}),
    ...(actionFilter ? { action: { startsWith: actionFilter } } : {}),
  }

  const events = await forTenant(session.tenantId, async (tx) => {
    return tx.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000, // hard cap for export
    })
  })

  const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean))] as string[]
  let actorMap: Map<string, string> = new Map()
  const sr = createServiceRoleClient()
  try {
    if (actorIds.length > 0) {
      const users = await sr.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
      actorMap = new Map(users.map((u) => [u.id, u.email]))
    }
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  const header = csvRow([
    'id',
    'timestamp_utc',
    'actor_email',
    'actor_role',
    'action',
    'resource',
    'resource_id',
    'metadata',
    'ip_address',
    'reason',
  ])

  const dataRows = events.map((e) =>
    csvRow([
      e.id,
      e.createdAt.toISOString(),
      e.actorId ? (actorMap.get(e.actorId) ?? e.actorId) : '',
      e.actorRole ?? '',
      e.action,
      e.resource,
      e.resourceId ?? '',
      JSON.stringify(e.metadata),
      e.ipAddress ?? '',
      e.reason ?? '',
    ])
  )

  const today = new Date().toISOString().slice(0, 10)
  const csv = '﻿' + [header, ...dataRows].join('\r\n') // BOM for Excel

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${today}.csv"`,
    },
  })
}
