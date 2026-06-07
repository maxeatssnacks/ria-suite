import crypto from 'node:crypto'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@ria/db'
import { getSessionUser } from '@/lib/session'
import { acceptInvitation } from './actions'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const srClient = createServiceRoleClient()
  let invitation
  try {
    invitation = await srClient.invitation.findUnique({
      where: { tokenHash },
      include: { tenant: { select: { name: true } } },
    })
  } finally {
    await srClient.$disconnect()
  }

  // Treat invalid/expired/used tokens as not found (no existence leak).
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    notFound()
  }

  const session = await getSessionUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold">You&apos;re invited</h1>
        <p className="text-muted-foreground mb-1 text-sm">
          <strong>{invitation.tenant.name}</strong> has invited you as{' '}
          <strong>{invitation.role.replace(/_/g, ' ')}</strong>.
        </p>
        <p className="text-muted-foreground mb-8 text-sm">Sent to {invitation.email}</p>

        {session ? (
          <form
            action={async () => {
              'use server'
              await acceptInvitation(token)
            }}
          >
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium"
            >
              Accept invitation
            </button>
          </form>
        ) : (
          <a
            href={`/auth/login?redirect=/invite/${token}`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 block rounded-md px-4 py-2 text-sm font-medium"
          >
            Sign in to accept
          </a>
        )}
      </div>
    </main>
  )
}
