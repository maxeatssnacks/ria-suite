'use client'

import { useActionState } from 'react'
import { requestModuleActivation, type ModuleActionState } from './actions'

const INITIAL: ModuleActionState = {}

export function RequestActivationForm({
  moduleId,
  moduleName,
}: {
  moduleId: string
  moduleName: string
}) {
  const [state, action, pending] = useActionState<ModuleActionState, FormData>(
    requestModuleActivation,
    INITIAL
  )

  if (state.success) {
    return <span className="text-sm text-green-600">{state.success}</span>
  }

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="moduleName" value={moduleName} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60"
      >
        {pending ? 'Requesting…' : 'Request activation'}
      </button>
      {state.error && <span className="text-destructive text-xs">{state.error}</span>}
    </form>
  )
}
