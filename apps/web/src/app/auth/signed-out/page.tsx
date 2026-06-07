export default function SignedOutPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-2xl font-bold">You&apos;ve been signed out</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Your session has ended. Sign in again to continue.
        </p>
        <a href="/auth/login" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Sign in
        </a>
      </div>
    </main>
  )
}
