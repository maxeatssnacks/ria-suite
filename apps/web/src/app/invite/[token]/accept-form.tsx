'use client'

import { useActionState } from 'react'
import { acceptInvitation, type AcceptInvitationState } from './actions'

const INITIAL: AcceptInvitationState = {}

export function AcceptForm({ token }: { token: string }) {
  // bind the token as the first arg; useActionState supplies (prevState, formData).
  const [state, formAction, pending] = useActionState<AcceptInvitationState, FormData>(
    acceptInvitation.bind(null, token),
    INITIAL
  )

  return (
    <form action={formAction}>
      {state.error ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-md border px-3 py-2 text-left text-sm"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Accepting…' : 'Accept invitation'}
      </button>
    </form>
  )
}
