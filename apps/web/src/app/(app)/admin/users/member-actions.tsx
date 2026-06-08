'use client'

import { useActionState } from 'react'
import { TENANT_ROLES } from '@ria/core'
import { changeRole, disableMember, reenableMember, type MemberActionState } from './actions'

const INITIAL: MemberActionState = {}

const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform Admin',
  tenant_admin: 'Tenant Admin',
  compliance: 'Compliance',
  supervisor: 'Supervisor',
  ops: 'Ops',
  advisor: 'Advisor',
  read_only: 'Read Only',
}

// Roles that can be assigned by a tenant_admin (platform_admin is excluded).
const ASSIGNABLE_ROLES = TENANT_ROLES.filter((r) => r !== 'platform_admin')

export function MemberRoleForm({
  userId,
  currentRole,
  isCurrentUser,
}: {
  userId: string
  currentRole: string
  isCurrentUser: boolean
}) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(changeRole, INITIAL)

  if (isCurrentUser) {
    return (
      <span className="text-muted-foreground text-xs">
        {ROLE_LABELS[currentRole] ?? currentRole}
      </span>
    )
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
        disabled={pending}
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r] ?? r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
      >
        {pending ? '…' : 'Save'}
      </button>
      {state.error && <span className="text-destructive text-xs">{state.error}</span>}
      {state.success && <span className="text-xs text-green-600">{state.success}</span>}
    </form>
  )
}

export function MemberDisableForm({
  userId,
  status,
  isCurrentUser,
}: {
  userId: string
  status: string
  isCurrentUser: boolean
}) {
  const isDisabled = status === 'disabled'
  const [disableState, disableAction, disablePending] = useActionState<MemberActionState, FormData>(
    disableMember,
    INITIAL
  )
  const [enableState, enableAction, enablePending] = useActionState<MemberActionState, FormData>(
    reenableMember,
    INITIAL
  )

  if (isCurrentUser) return null

  const pending = disablePending || enablePending
  const error = disableState.error ?? enableState.error

  return (
    <div className="flex items-center gap-1">
      <form action={isDisabled ? enableAction : disableAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={pending}
          className={`rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${
            isDisabled
              ? 'hover:bg-accent'
              : 'border-destructive/40 text-destructive hover:bg-destructive/10'
          }`}
        >
          {pending ? '…' : isDisabled ? 'Re-enable' : 'Disable'}
        </button>
      </form>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  )
}
