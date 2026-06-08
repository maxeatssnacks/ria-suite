import Link from 'next/link'
import { createServiceRoleClient } from '@ria/db'

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  trial: 'bg-blue-100 text-blue-700',
}

export default async function PlatformTenantsPage() {
  const sr = createServiceRoleClient()
  let tenants
  try {
    tenants = await sr.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { memberships: true, tenantModules: true } },
      },
    })
  } finally {
    await sr.$disconnect().catch(() => {})
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tenants</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">All RIA firms on the platform.</p>
        </div>
        <Link
          href="/platform/tenants/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          New tenant
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Slug</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Tier</th>
              <th className="px-4 py-2.5 text-left font-medium">Members</th>
              <th className="px-4 py-2.5 text-left font-medium">Modules</th>
              <th className="px-4 py-2.5 text-left font-medium">Created</th>
              <th className="px-4 py-2.5 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASSES[t.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {t.isolationTier.replace(/_/g, ' ')}
                </td>
                <td className="text-muted-foreground px-4 py-3">{t._count.memberships}</td>
                <td className="text-muted-foreground px-4 py-3">{t._count.tenantModules}</td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {t.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <a href={`/platform/tenants/${t.id}`} className="text-xs hover:underline">
                    View
                  </a>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted-foreground px-4 py-8 text-center text-sm">
                  No tenants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
