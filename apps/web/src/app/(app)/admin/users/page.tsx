import { redirect } from 'next/navigation'
import { forTenant } from '@ria/db'
import { can } from '@ria/core'
import { getSession } from '@/lib/session'
import { MemberRoleForm, MemberDisableForm } from './member-actions'
import { InviteForm } from './invite-form'

export default async function AdminUsersPage() {
  const session = await getSession()
  if (!session.userId || !session.tenantId) redirect('/auth/login')
  if (!can({ role: session.role }, 'membership.change_role')) redirect('/dashboard')

  const memberships = await forTenant(session.tenantId, async (tx) => {
    return tx.tenantMembership.findMany({
      where: { tenantId: session.tenantId! },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })
  })

  const active = memberships.filter((m) => m.status !== 'disabled')
  const disabled = memberships.filter((m) => m.status === 'disabled')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users &amp; Roles</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage who has access to your firm and what they can do.
          </p>
        </div>
        <InviteForm />
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Email</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Role</th>
              <th className="px-4 py-2.5 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {active.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-3">{m.user.name}</td>
                <td className="text-muted-foreground px-4 py-3">{m.user.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <MemberRoleForm
                    userId={m.user.id}
                    currentRole={m.role}
                    isCurrentUser={m.user.id === session.userId}
                  />
                </td>
                <td className="px-4 py-3">
                  <MemberDisableForm
                    userId={m.user.id}
                    status={m.status}
                    isCurrentUser={m.user.id === session.userId}
                  />
                </td>
              </tr>
            ))}
            {active.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center text-sm">
                  No active members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {disabled.length > 0 && (
        <details className="mt-6">
          <summary className="text-muted-foreground cursor-pointer text-sm">
            Disabled members ({disabled.length})
          </summary>
          <div className="mt-2 rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {disabled.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{m.user.name}</td>
                    <td className="text-muted-foreground px-4 py-3">{m.user.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        disabled
                      </span>
                    </td>
                    <td className="px-4 py-3">{m.role.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <MemberDisableForm
                        userId={m.user.id}
                        status={m.status}
                        isCurrentUser={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
