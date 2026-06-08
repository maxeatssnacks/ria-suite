import { redirect } from 'next/navigation'
import { forTenant, createServiceRoleClient } from '@ria/db'
import { can } from '@ria/core'
import { getSession } from '@/lib/session'

const PAGE_SIZE = 25

function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'audit.read')) redirect('/dashboard')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = sp.from ?? ''
  const to = sp.to ?? ''
  const actionFilter = sp.action ?? ''

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

  // Tenant-scoped events via RLS.
  const events = await forTenant(session.tenantId, async (tx) => {
    return tx.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    })
  })

  const hasNext = events.length > PAGE_SIZE
  const rows = events.slice(0, PAGE_SIZE)
  const actorIds = [...new Set(rows.map((e) => e.actorId).filter(Boolean))] as string[]

  // Service role for actor names and tenant timezone.
  let actorMap: Map<string, string> = new Map()
  let timezone = 'America/New_York'
  const sr = createServiceRoleClient()
  try {
    if (actorIds.length > 0) {
      const users = await sr.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
      actorMap = new Map(users.map((u) => [u.id, `${u.name} <${u.email}>`]))
    }
    const tenant = await sr.tenant.findUnique({
      where: { id: session.tenantId },
      select: { timezone: true },
    })
    timezone = tenant?.timezone ?? 'America/New_York'
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  const exportParams = new URLSearchParams()
  if (from) exportParams.set('from', from)
  if (to) exportParams.set('to', to)
  if (actionFilter) exportParams.set('action', actionFilter)
  const exportHref = `/api/audit/export?${exportParams}`

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Audit Log</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            All recorded actions within your firm.
          </p>
        </div>
        <a
          href={exportHref}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          download
        >
          Export CSV
        </a>
      </div>

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Action prefix</label>
          <input
            type="text"
            name="action"
            defaultValue={actionFilter}
            placeholder="e.g. user. or invitation."
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <input type="hidden" name="page" value="1" />
        <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          Filter
        </button>
        {(from || to || actionFilter) && (
          <a href="/admin/audit" className="text-muted-foreground text-sm hover:underline">
            Clear
          </a>
        )}
      </form>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2.5 text-left font-medium">Time</th>
              <th className="px-4 py-2.5 text-left font-medium">Actor</th>
              <th className="px-4 py-2.5 text-left font-medium">Role</th>
              <th className="px-4 py-2.5 text-left font-medium">Action</th>
              <th className="px-4 py-2.5 text-left font-medium">Resource</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr key={event.id} className="border-b last:border-0">
                <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                  {formatDate(event.createdAt, timezone)}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {event.actorId ? (actorMap.get(event.actorId) ?? event.actorId) : '—'}
                </td>
                <td className="text-muted-foreground px-4 py-2.5 text-xs">
                  {event.actorRole ?? '—'}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{event.action}</td>
                <td className="text-muted-foreground px-4 py-2.5 text-xs">
                  {event.resource}
                  {event.resourceId && (
                    <span className="ml-1 font-mono">{event.resourceId.slice(0, 8)}…</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center text-sm">
                  No audit events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} · showing up to {PAGE_SIZE} per page
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a
              href={`?page=${page - 1}&from=${from}&to=${to}&action=${actionFilter}`}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              Previous
            </a>
          )}
          {hasNext && (
            <a
              href={`?page=${page + 1}&from=${from}&to=${to}&action=${actionFilter}`}
              className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
              Next
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
