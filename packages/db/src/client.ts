import { PrismaClient } from '@prisma/client'

// ─── Prisma singleton ──────────────────────────────────────────────────────────
// In tests, EmbeddedPostgres sets DATABASE_URL before this module loads.
// In production, DATABASE_URL is the pooled connection; DIRECT_URL is direct.

function createPrismaClient() {
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  })
}

const globalForPrisma = global as unknown as { prisma?: ReturnType<typeof createPrismaClient> }
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
  return prisma.$transaction(async (tx) => {
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
