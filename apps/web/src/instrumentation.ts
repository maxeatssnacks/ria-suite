// Next.js instrumentation — runs once when the server process starts.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Prisma 5 interactive transactions send an internal ROLLBACK after any
  // failed callback. If that cleanup itself fails (e.g. connection in a bad
  // state after an RLS 42501 error), Prisma leaks an unhandled Promise
  // rejection. Our server actions have correct try/catch and always return an
  // error state — the crash is from Prisma internals, not application code.
  // This handler logs the rejection and keeps the process alive.
  process.on('unhandledRejection', (reason) => {
    console.error('[instrumentation] unhandledRejection (process protected):', reason)
  })
}
