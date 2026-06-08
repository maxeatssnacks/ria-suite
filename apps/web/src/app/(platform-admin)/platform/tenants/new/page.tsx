'use client'

import { useActionState } from 'react'
import { createTenant, type CreateTenantState } from './actions'

const INITIAL: CreateTenantState = {}

export default function NewTenantPage() {
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(
    createTenant,
    INITIAL
  )

  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <a href="/platform" className="text-muted-foreground text-sm hover:underline">
          ← Tenants
        </a>
        <h1 className="mt-2 text-xl font-semibold">Create new tenant</h1>
      </div>

      <form action={action} className="space-y-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Firm name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            disabled={pending}
            onChange={(e) => {
              const slugInput = document.getElementById('slug') as HTMLInputElement | null
              if (slugInput && !slugInput.dataset.edited) {
                slugInput.value = slugify(e.target.value)
              }
            }}
          />
          {state.fieldErrors?.name && (
            <p className="text-destructive text-xs">{state.fieldErrors.name}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug" className="text-sm font-medium">
            Slug <span className="text-muted-foreground font-normal">(URL-safe identifier)</span>
          </label>
          <input
            id="slug"
            name="slug"
            required
            minLength={2}
            maxLength={50}
            pattern="[a-z0-9-]+"
            className="border-input bg-background rounded-md border px-3 py-2 font-mono text-sm"
            disabled={pending}
            onInput={(e) => {
              const el = e.currentTarget
              el.dataset.edited = '1'
            }}
          />
          {state.fieldErrors?.slug && (
            <p className="text-destructive text-xs">{state.fieldErrors.slug}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="isolationTier" className="text-sm font-medium">
            Isolation tier
          </label>
          <select
            id="isolationTier"
            name="isolationTier"
            defaultValue="logical"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            disabled={pending}
          >
            <option value="logical">Logical (shared DB, RLS)</option>
            <option value="dedicated_db">Dedicated database</option>
            <option value="dedicated_deploy">Dedicated deployment</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            Reason{' '}
            <span className="text-muted-foreground font-normal">
              (required for all platform actions)
            </span>
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="e.g. New RIA firm onboarded via sales — account exec: Jane Smith"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            disabled={pending}
          />
          {state.fieldErrors?.reason && (
            <p className="text-destructive text-xs">{state.fieldErrors.reason}</p>
          )}
        </div>

        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create tenant'}
          </button>
          <a href="/platform" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
