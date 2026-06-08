'use client'

import { useState } from 'react'
import { TENANT_ROLES } from '@ria/core'

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Tenant Admin',
  compliance: 'Compliance',
  supervisor: 'Supervisor',
  ops: 'Ops',
  advisor: 'Advisor',
  read_only: 'Read Only',
}

const ASSIGNABLE_ROLES = TENANT_ROLES.filter((r) => r !== 'platform_admin')

export function InviteForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('ops')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string }>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setResult({})
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (res.ok) {
        setResult({ success: true })
        setEmail('')
        setRole('ops')
        setTimeout(() => {
          setOpen(false)
          setResult({})
        }, 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        setResult({ error: data.error ?? 'Failed to send invitation.' })
      }
    } catch {
      setResult({ error: 'Network error. Please try again.' })
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium"
      >
        Invite user
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-lg border p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@firm.com"
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
          disabled={pending}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send invite'}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false)
          setResult({})
        }}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
      >
        Cancel
      </button>
      {result.error && <span className="text-destructive text-sm">{result.error}</span>}
      {result.success && <span className="text-sm text-green-600">Invitation sent!</span>}
    </form>
  )
}
