import { getSession } from '@/lib/session'

export default async function NoAccessPage() {
  const session = await getSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-2xl font-bold">No tenant access</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Your account ({session.email}) is not a member of any active tenant. Contact your
          administrator to receive an invitation.
        </p>
        <a href="/auth/logout" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Sign out
        </a>
      </div>
    </main>
  )
}
