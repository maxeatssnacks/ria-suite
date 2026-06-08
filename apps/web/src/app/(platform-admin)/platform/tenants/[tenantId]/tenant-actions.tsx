'use client'

import { useActionState } from 'react'
import {
  suspendTenant,
  activateTenant,
  platformModuleAction,
  type PlatformTenantActionState,
} from './actions'

const INITIAL: PlatformTenantActionState = {}

function ReasonForm({
  action,
  buttonLabel,
  buttonClass,
}: {
  action: (prev: PlatformTenantActionState, fd: FormData) => Promise<PlatformTenantActionState>
  buttonLabel: string
  buttonClass: string
}) {
  const [state, formAction, pending] = useActionState<PlatformTenantActionState, FormData>(
    action,
    INITIAL
  )

  if (state.success) return <p className="text-sm text-green-600">{state.success}</p>

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">
          Reason <span className="text-muted-foreground">(required)</span>
        </label>
        <textarea
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={2}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          disabled={pending}
        />
      </div>
      {state.error && <p className="text-destructive text-xs">{state.error}</p>}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? 'Working…' : buttonLabel}
      </button>
    </form>
  )
}

export function SuspendTenantForm({ tenantId }: { tenantId: string }) {
  return (
    <ReasonForm
      action={suspendTenant.bind(null, tenantId)}
      buttonLabel="Suspend tenant"
      buttonClass="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
    />
  )
}

export function ActivateTenantForm({ tenantId }: { tenantId: string }) {
  return (
    <ReasonForm
      action={activateTenant.bind(null, tenantId)}
      buttonLabel="Activate tenant"
      buttonClass="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
    />
  )
}

export function ModuleActionForm({
  tenantId,
  moduleId,
  moduleName,
  currentAction,
}: {
  tenantId: string
  moduleId: string
  moduleName: string
  currentAction: 'activate' | 'deactivate'
}) {
  const [state, formAction, pending] = useActionState<PlatformTenantActionState, FormData>(
    platformModuleAction,
    INITIAL
  )

  if (state.success) return <p className="text-xs text-green-600">{state.success}</p>

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="action" value={currentAction} />
      <div className="flex items-center gap-2">
        <input
          name="reason"
          required
          minLength={10}
          maxLength={500}
          placeholder={`Reason for ${currentAction === 'activate' ? 'activating' : 'deactivating'} ${moduleName}`}
          className="border-input bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-xs"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className={`shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${
            currentAction === 'activate'
              ? 'hover:bg-accent'
              : 'border-red-300 text-red-700 hover:bg-red-50'
          }`}
        >
          {pending ? '…' : currentAction === 'activate' ? 'Activate' : 'Deactivate'}
        </button>
      </div>
      {state.error && <p className="text-destructive text-xs">{state.error}</p>}
    </form>
  )
}
