import { PrismaClient } from '@prisma/client'

// ─── Lazy Prisma singleton ─────────────────────────────────────────────────────
// The client is not instantiated until the first method call. This allows Next.js
// to import the module during build (static analysis) without DATABASE_URL set.
// In production (Vercel), env vars are injected before any request is served.

function createPrismaClient() {
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  })
}

const globalForPrisma = global as unknown as { _prisma?: PrismaClient }

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma._prisma) {
    globalForPrisma._prisma = createPrismaClient()
  }
  return globalForPrisma._prisma
}

// Proxy defers instantiation to the first property access.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop)
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
})

// ─── Service-role client ───────────────────────────────────────────────────────
// Connects via DIRECT_URL (bypasses pgBouncer) and runs as the superuser.
// MUST only be instantiated in server-side code.
// Every call site MUST be catalogued in SERVICE_ROLE_USAGE.md.
//
// SERVICE ROLE USAGE — slug lookup during WorkOS callback (pre-tenant context):
//   serviceRolePrisma.tenant.findUnique({ where: { slug } })
//   Reason: tenant context is not yet set; RLS would deny the select.
export function createServiceRoleClient() {
  return new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
  })
}

// ─── $forTenant extension ──────────────────────────────────────────────────────
// All application queries that touch tenant-scoped tables MUST go through
// $forTenant. It:
//   1. Wraps the callback in a transaction.
//   2. Sets SET LOCAL ROLE app_user — the restricted role with no BYPASSRLS.
//   3. Sets transaction-local app.tenant_id and (optionally) app.user_id.
//
// The callback receives the same PrismaClient instance so it can issue
// queries inside the same transaction context.

export type ForTenantOptions = {
  userId?: string
}

export type ForTenantCallback<T> = (tx: PrismaClient) => Promise<T>

export async function forTenant<T>(
  tenantId: string,
  callback: ForTenantCallback<T>,
  options: ForTenantOptions = {}
): Promise<T> {
  // `return await` (not bare `return`) ensures the rejection is owned by this
  // async function before propagating to the caller. This prevents Node.js from
  // briefly flagging the $transaction Promise as "unhandled" during the
  // microtask gap between the Promise being created and the caller's await
  // attaching a rejection handler.
  return await prisma.$transaction(async (tx) => {
    const client = tx as unknown as PrismaClient

    await tx.$executeRawUnsafe(`SET LOCAL ROLE app_user`)
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId)
    if (options.userId) {
      await tx.$executeRawUnsafe(`SELECT set_config('app.user_id', $1, true)`, options.userId)
    }

    return callback(client)
  })
}

// Attach forTenant as a method on prisma for ergonomics.
// Usage: await db.$forTenant(tenantId, (tx) => tx.user.findMany(), { userId })
export const db = Object.assign(prisma, {
  $forTenant: forTenant,
  $serviceRole: createServiceRoleClient,
})
