/**
 * Tenant isolation test suite — programmatically generated.
 *
 * For every tenant-scoped table, verifies that:
 *   1. A row belonging to tenant A is visible when context = tenant A.
 *   2. The same row is NOT visible when context = tenant B.
 *   3. No context (empty tenant_id) → zero rows.
 *
 * Runs as app_user (restricted role, subject to RLS).
 */

import { Client } from 'pg'
import { getConnUrl, getAppUserConnUrl, getConnectorConnUrl } from './setup.js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// All tenant-scoped tables and their tenant_id column.
// Extend this list when adding new tables — CI check-rls.ts will also catch omissions.
const TENANT_SCOPED_TABLES: Array<{
  table: string
  insertRow: (tenantId: string, extra?: Record<string, string>) => string
  // Returns SQL counting only the test-inserted row, identified by a unique extra field.
  // Used instead of SELECT COUNT(*) to avoid false positives from fixture rows.
  findTestRow: (extra: Record<string, string>) => string
}> = [
  {
    table: 'tenant_memberships',
    insertRow: (tenantId, extra = {}) =>
      `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ('${tenantId}', '${extra.userId}', 'advisor')`,
    // extraUserId is only ever inserted for this table's test rows; unique enough.
    findTestRow: (extra) =>
      `SELECT COUNT(*) FROM tenant_memberships WHERE user_id = '${extra.userId}' AND role = 'advisor'`,
  },
  {
    table: 'tenant_modules',
    insertRow: (tenantId, extra = {}) =>
      `INSERT INTO tenant_modules (tenant_id, module_id) VALUES ('${tenantId}', '${extra.moduleId}')`,
    findTestRow: (extra) =>
      `SELECT COUNT(*) FROM tenant_modules WHERE module_id = '${extra.moduleId}'`,
  },
  {
    table: 'audit_events',
    insertRow: (tenantId) =>
      `INSERT INTO audit_events (tenant_id, action, resource) VALUES ('${tenantId}', 'test.action', 'test')`,
    findTestRow: () => `SELECT COUNT(*) FROM audit_events WHERE action = 'test.action'`,
  },
  {
    table: 'invitations',
    insertRow: (tenantId, extra = {}) =>
      `INSERT INTO invitations (tenant_id, email, role, token_hash, expires_at, created_by)
       VALUES ('${tenantId}', 'invite@example.com', 'advisor', '${extra.tokenHash}', NOW() + INTERVAL '1 day', '${extra.userId}')`,
    findTestRow: (extra) =>
      `SELECT COUNT(*) FROM invitations WHERE token_hash = '${extra.tokenHash}'`,
  },
  {
    table: 'api_keys',
    insertRow: (tenantId, extra = {}) =>
      `INSERT INTO api_keys (tenant_id, name, key_hash, created_by)
       VALUES ('${tenantId}', 'test-key', '${extra.keyHash}', '${extra.userId}')`,
    findTestRow: (extra) => `SELECT COUNT(*) FROM api_keys WHERE key_hash = '${extra.keyHash}'`,
  },
]

// ─── Fixtures ──────────────────────────────────────────────────────────────────

let tenantAId: string
let tenantBId: string
let userAId: string
let userBId: string
// Separate user with no existing membership — used for tenant_memberships isolation inserts
// so we don't collide with the tenant_admin fixtures.
let extraUserId: string
let moduleId: string
let superClient: Client

async function q(client: Client, sql: string, params?: unknown[]) {
  return client.query(sql, params)
}

beforeAll(async () => {
  superClient = new Client({ connectionString: getConnUrl() })
  await superClient.connect()

  // Tenants
  const tA = await q(
    superClient,
    `INSERT INTO tenants (name, slug) VALUES ('Tenant A', 'tenant-a') RETURNING id`
  )
  const tB = await q(
    superClient,
    `INSERT INTO tenants (name, slug) VALUES ('Tenant B', 'tenant-b') RETURNING id`
  )
  tenantAId = tA.rows[0].id as string
  tenantBId = tB.rows[0].id as string

  // Users
  const uA = await q(
    superClient,
    `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-a', 'a@a.com', 'User A') RETURNING id`
  )
  const uB = await q(
    superClient,
    `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-b', 'b@b.com', 'User B') RETURNING id`
  )
  const uExtra = await q(
    superClient,
    `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-extra', 'extra@a.com', 'Extra User') RETURNING id`
  )
  userAId = uA.rows[0].id as string
  userBId = uB.rows[0].id as string
  extraUserId = uExtra.rows[0].id as string

  // Module
  const mod = await q(
    superClient,
    `INSERT INTO modules (key, name) VALUES ('test-mod', 'Test Module') RETURNING id`
  )
  moduleId = mod.rows[0].id as string

  // Memberships (needed for users RLS + write policies)
  await q(
    superClient,
    `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'tenant_admin')`,
    [tenantAId, userAId]
  )
  await q(
    superClient,
    `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'tenant_admin')`,
    [tenantBId, userBId]
  )
})

afterEach(async () => {
  // Clean up test rows between table-level tests (keep base fixtures)
  await superClient.query(`DELETE FROM api_keys WHERE name = 'test-key'`)
  await superClient.query(`DELETE FROM invitations WHERE email = 'invite@example.com'`)
  await superClient.query(`DELETE FROM audit_events WHERE action = 'test.action'`)
  await superClient.query(`DELETE FROM tenant_modules WHERE module_id = $1`, [moduleId])
  await superClient.query(`DELETE FROM tenant_memberships WHERE role = 'advisor'`)
})

// Close superClient before postgres shuts down to avoid unhandled connection-termination errors.
afterAll(async () => {
  await superClient.end().catch(() => undefined)
})

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function appUserClient() {
  const client = new Client({ connectionString: getAppUserConnUrl() })
  await client.connect()
  return client
}

async function withTenantContext(client: Client, tenantId: string, userId?: string) {
  await client.query('BEGIN')
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId])
  if (userId) {
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId])
  }
}

async function countRows(client: Client, table: string): Promise<number> {
  const res = await client.query(`SELECT COUNT(*) FROM "${table}"`)
  return parseInt(res.rows[0].count as string, 10)
}

// ─── Generated isolation tests ─────────────────────────────────────────────────

for (const { table, insertRow, findTestRow } of TENANT_SCOPED_TABLES) {
  describe(`${table} — tenant isolation`, () => {
    let client: Client

    beforeEach(async () => {
      client = await appUserClient()
    })

    afterEach(async () => {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end()
    })

    it('sees own-tenant rows when context is set', async () => {
      // extraUserId avoids unique-constraint collision with the tenant_admin fixture row.
      const extra = {
        userId: extraUserId,
        moduleId,
        tokenHash: `hash-${table}-a-${Date.now()}`,
        keyHash: `keyhash-${table}-a-${Date.now()}`,
      }
      await superClient.query(insertRow(tenantAId, extra))

      await withTenantContext(client, tenantAId, userAId)
      const res = await client.query(findTestRow(extra))
      await client.query('ROLLBACK')

      expect(parseInt(res.rows[0].count as string, 10)).toBe(1)
    })

    it('cannot see other-tenant rows', async () => {
      const extra = {
        userId: extraUserId,
        moduleId,
        tokenHash: `hash-${table}-b-${Date.now()}`,
        keyHash: `keyhash-${table}-b-${Date.now()}`,
      }
      await superClient.query(insertRow(tenantAId, extra))

      // Query the specific row as tenant B — should be invisible
      await withTenantContext(client, tenantBId, userBId)
      const res = await client.query(findTestRow(extra))
      await client.query('ROLLBACK')

      expect(parseInt(res.rows[0].count as string, 10)).toBe(0)
    })

    it('sees zero rows with no tenant context', async () => {
      const extra = {
        userId: extraUserId,
        moduleId,
        tokenHash: `hash-${table}-nc-${Date.now()}`,
        keyHash: `keyhash-${table}-nc-${Date.now()}`,
      }
      await superClient.query(insertRow(tenantAId, extra))

      // No tenant context set — specific row should be invisible
      await client.query('BEGIN')
      const res = await client.query(findTestRow(extra))
      await client.query('ROLLBACK')

      expect(parseInt(res.rows[0].count as string, 10)).toBe(0)
    })
  })
}

// ─── users table isolation ─────────────────────────────────────────────────────
// users doesn't have a direct tenant_id — isolated via membership join.

describe('users — tenant isolation via membership', () => {
  let client: Client

  beforeEach(async () => {
    client = await appUserClient()
  })

  afterEach(async () => {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  })

  it('sees users who share tenant A membership when context = tenant A', async () => {
    await withTenantContext(client, tenantAId, userAId)
    const res = await client.query(`SELECT id FROM users WHERE id = $1`, [userAId])
    await client.query('ROLLBACK')
    expect(res.rows).toHaveLength(1)
  })

  it('cannot see tenant A users when context = tenant B', async () => {
    await withTenantContext(client, tenantBId, userBId)
    const res = await client.query(`SELECT id FROM users WHERE id = $1`, [userAId])
    await client.query('ROLLBACK')
    expect(res.rows).toHaveLength(0)
  })
})

// ─── Connector-path isolation (non-superuser role + SET LOCAL ROLE) ────────────
// These tests mirror the production path on hosted Postgres (e.g. Supabase), where
// the connecting role ("postgres") is NOT a superuser and must rely on the membership
// grant from migration 20260607000001 to perform SET LOCAL ROLE app_user.
//
// If the migration grant is absent, the SET LOCAL ROLE call in the helpers below
// will throw "permission denied to set role app_user", failing these tests before
// any RLS assertion runs — giving a clear, actionable signal.

async function connectorClient() {
  const client = new Client({ connectionString: getConnectorConnUrl() })
  await client.connect()
  return client
}

// Mirrors forTenant() in client.ts: non-superuser connects, then switches to app_user
// for the duration of the transaction.
async function withTenantContextViaRole(client: Client, tenantId: string, userId?: string) {
  await client.query('BEGIN')
  await client.query('SET LOCAL ROLE app_user')
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId])
  if (userId) {
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId])
  }
}

describe('connector-path — SET LOCAL ROLE + RLS', () => {
  let client: Client

  beforeEach(async () => {
    client = await connectorClient()
  })

  afterEach(async () => {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  })

  it('non-superuser connector can SET LOCAL ROLE app_user (grant present)', async () => {
    await client.query('BEGIN')
    // Fails with "permission denied" if GRANT app_user TO app_connect is missing.
    await expect(client.query('SET LOCAL ROLE app_user')).resolves.toBeDefined()
    await client.query('ROLLBACK')
  })

  it('sees own-tenant rows after SET LOCAL ROLE', async () => {
    await withTenantContextViaRole(client, tenantAId, userAId)
    const res = await client.query(`SELECT id FROM tenant_memberships WHERE tenant_id = $1`, [
      tenantAId,
    ])
    await client.query('ROLLBACK')
    expect(res.rows.length).toBeGreaterThan(0)
  })

  it('cannot see other-tenant rows after SET LOCAL ROLE', async () => {
    await withTenantContextViaRole(client, tenantBId, userBId)
    const res = await client.query(`SELECT id FROM tenant_memberships WHERE tenant_id = $1`, [
      tenantAId,
    ])
    await client.query('ROLLBACK')
    expect(res.rows).toHaveLength(0)
  })
})

// ─── SET LOCAL ROLE — no-leak-after-transaction ────────────────────────────────
// Verifies that SET LOCAL (not SET) is used, so the role reverts when the
// transaction ends. If SET ROLE (without LOCAL) were used instead, a committed
// or rolled-back transaction would leave the connection permanently running as
// app_user — a privilege escalation risk for pooled connections.

describe('SET LOCAL ROLE — no leak after transaction', () => {
  it('role reverts to connector role after COMMIT', async () => {
    const client = new Client({ connectionString: getConnectorConnUrl() })
    await client.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE app_user')

      const during = await client.query('SELECT current_user AS u')
      expect(during.rows[0].u).toBe('app_user')

      await client.query('COMMIT')

      // After commit the role must revert — SET LOCAL scopes to the transaction.
      const after = await client.query('SELECT current_user AS u')
      expect(after.rows[0].u).toBe('app_connect')
    } finally {
      await client.end()
    }
  })

  it('role reverts to connector role after ROLLBACK', async () => {
    const client = new Client({ connectionString: getConnectorConnUrl() })
    await client.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE app_user')
      await client.query('ROLLBACK')

      const after = await client.query('SELECT current_user AS u')
      expect(after.rows[0].u).toBe('app_connect')
    } finally {
      await client.end()
    }
  })
})
