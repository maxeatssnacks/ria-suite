'use client'

import { useActionState } from 'react'
import { US_TIMEZONES } from '@ria/core'
import { updateSettings, type SettingsState } from './actions'

const INITIAL: SettingsState = {}

export function SettingsForm({
  name,
  timezone,
  notificationEmail,
  notifyOnLogin,
  notifyOnAdminAction,
}: {
  name: string
  timezone: string
  notificationEmail: string | null | undefined
  notifyOnLogin: boolean
  notifyOnAdminAction: boolean
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSettings, INITIAL)

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-base font-semibold">General</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Firm name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={name}
              required
              maxLength={100}
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className="text-sm font-medium">
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              disabled={pending}
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Logo</h2>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Logo upload</label>
          <input
            type="file"
            disabled
            className="border-input rounded-md border px-3 py-2 text-sm opacity-50"
            title="R2 file storage not yet configured"
          />
          <p className="text-muted-foreground text-xs">
            {/* TODO (Part F): wire R2 upload — R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
                R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME env vars needed */}
            Logo upload is not yet available. R2 storage will be configured in a future release.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Notifications</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notificationEmail" className="text-sm font-medium">
            Notification email <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="notificationEmail"
            name="notificationEmail"
            type="email"
            defaultValue={notificationEmail ?? ''}
            placeholder="admin@yourfirm.com"
            className="border-input bg-background max-w-sm rounded-md border px-3 py-2 text-sm"
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">
            Platform alerts and admin summaries are sent here.
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="notifyOnLogin"
              defaultChecked={notifyOnLogin}
              disabled={pending}
              className="rounded"
            />
            Notify on new logins
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="notifyOnAdminAction"
              defaultChecked={notifyOnAdminAction}
              disabled={pending}
              className="rounded"
            />
            Notify on admin actions (role changes, module requests)
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t pt-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      </div>
    </form>
  )
}
