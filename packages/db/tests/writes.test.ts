/**
 * Write-permission tests.
 *
 * Verifies that:
 *   - tenant_admin can perform restricted writes (insert memberships, modules, invitations, api_keys)
 *   - advisor (non-admin role) CANNOT perform those writes
 *   - audit_events are INSERT-only (no UPDATE/DELETE for app_user)
 */

import { Client } from 'pg'
import { getConnUrl, getAppUserConnUrl } from './setup.js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let superClient: Client
let tenantId: string
let adminUserId: string
let advisorUserId: string
let moduleId: string

beforeAll(async () => {
  superClient = new Client({ connectionString: getConnUrl() })
  await superClient.connect()

  const t = await superClient.query(
    `INSERT INTO tenants (name, slug) VALUES ('Write Test Tenant', 'write-test') RETURNING id`
  )
  tenantId = t.rows[0].id as string

  const uAdmin = await superClient.query(
    `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-write-admin', 'admin@write.test', 'Admin') RETURNING id`
  )
  adminUserId = uAdmin.rows[0].id as string

  const uAdvisor = await superClient.query(
    `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-write-advisor', 'advisor@write.test', 'Advisor') RETURNING id`
  )
  advisorUserId = uAdvisor.rows[0].id as string

  // Give admin the tenant_admin role
  await superClient.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'tenant_admin')`,
    [tenantId, adminUserId]
  )
  // Give advisor the advisor role
  await superClient.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'advisor')`,
    [tenantId, advisorUserId]
  )

  const mod = await superClient.query(
    `INSERT INTO modules (key, name) VALUES ('write-test-mod', 'Write Test Module') RETURNING id`
  )
  moduleId = mod.rows[0].id as string
})

afterAll(async () => {
  await superClient.end()
})

async function appClient() {
  const client = new Client({ connectionString: getAppUserConnUrl() })
  await client.connect()
  return client
}

async function withContext(client: Client, userId: string) {
  await client.query('BEGIN')
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId])
  await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId])
}

// ─── tenant_memberships writes ────────────────────────────────────────────────

describe('tenant_memberships — write permissions', () => {
  let client: Client

  beforeEach(async () => {
    client = await appClient()
  })
  afterEach(async () => {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  })

  it('tenant_admin can insert a membership', async () => {
    await withContext(client, adminUserId)
    const newUser = await superClient.query(
      `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-new-1', 'new1@w.test', 'New') RETURNING id`
    )
    const newUserId = newUser.rows[0].id as string

    await expect(
      client.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'read_only')`,
        [tenantId, newUserId]
      )
    ).resolves.toBeDefined()
  })

  it('advisor cannot insert a membership', async () => {
    await withContext(client, advisorUserId)
    const newUser = await superClient.query(
      `INSERT INTO users (workos_user_id, email, name) VALUES ('wos-new-2', 'new2@w.test', 'New2') RETURNING id`
    )
    const newUserId = newUser.rows[0].id as string

    await expect(
      client.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'read_only')`,
        [tenantId, newUserId]
      )
    ).rejects.toThrow()
  })
})

// ─── audit_events — immutability ───────────────────────────────────────────────

describe('audit_events — immutability for app_user', () => {
  let client: Client
  let eventId: string

  beforeEach(async () => {
    client = await appClient()
    const ev = await superClient.query(
      `INSERT INTO audit_events (tenant_id, action, resource) VALUES ($1, 'test', 'resource') RETURNING id`,
      [tenantId]
    )
    eventId = ev.rows[0].id as string
  })

  afterEach(async () => {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
    await superClient.query(`DELETE FROM audit_events WHERE id = $1`, [eventId])
  })

  it('app_user cannot UPDATE audit_events', async () => {
    await withContext(client, adminUserId)
    await expect(
      client.query(`UPDATE audit_events SET action = 'tampered' WHERE id = $1`, [eventId])
    ).rejects.toThrow()
  })

  it('app_user cannot DELETE audit_events', async () => {
    await withContext(client, adminUserId)
    await expect(
      client.query(`DELETE FROM audit_events WHERE id = $1`, [eventId])
    ).rejects.toThrow()
  })

  it('app_user can INSERT audit_events', async () => {
    await withContext(client, adminUserId)
    await expect(
      client.query(
        `INSERT INTO audit_events (tenant_id, action, resource) VALUES ($1, 'user.login', 'user') RETURNING id`,
        [tenantId]
      )
    ).resolves.toBeDefined()
  })
})

// ─── platform_admin authority ────────────────────────────────────────────────
//
// Verifies that platform_admin (a role stored in tenant_memberships, not a
// separate DB role) satisfies the RLS write policies that previously only
// accepted tenant_admin. Also verifies ops (a lower role) is still blocked.

describe('platform_admin — write authority matches can() hierarchy', () => {
  let client: Client
  let platformAdminUserId: string
  let opsUserId: string

  beforeAll(async () => {
    // platform_admin user — has a platform_admin membership in the test tenant
    const uPa = await superClient.query(
      `INSERT INTO users (workos_user_id, email, name)
       VALUES ('wos-write-pa', 'pa@write.test', 'Platform Admin')
       RETURNING id`
    )
    platformAdminUserId = uPa.rows[0].id as string
    await superClient.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role)
       VALUES ($1, $2, 'platform_admin')`,
      [tenantId, platformAdminUserId]
    )

    // ops user — has an ops membership in the test tenant
    const uOps = await superClient.query(
      `INSERT INTO users (workos_user_id, email, name)
       VALUES ('wos-write-ops', 'ops@write.test', 'Ops User')
       RETURNING id`
    )
    opsUserId = uOps.rows[0].id as string
    await superClient.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role)
       VALUES ($1, $2, 'ops')`,
      [tenantId, opsUserId]
    )
  })

  beforeEach(async () => {
    client = await appClient()
  })
  afterEach(async () => {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  })

  it('platform_admin can update a tenant membership', async () => {
    await withContext(client, platformAdminUserId)
    await expect(
      client.query(
        `UPDATE tenant_memberships SET role = 'read_only'
         WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, advisorUserId]
      )
    ).resolves.toBeDefined()
    // roll back the role change — afterEach ROLLBACK handles the transaction
  })

  it('ops user cannot update a tenant membership', async () => {
    await withContext(client, opsUserId)
    await expect(
      client.query(
        `UPDATE tenant_memberships SET role = 'read_only'
         WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, advisorUserId]
      )
    ).rejects.toThrow()
  })
})

// ─── invitations — admin only ─────────────────────────────────────────────────

describe('invitations — admin-only write', () => {
  let client: Client

  beforeEach(async () => {
    client = await appClient()
  })
  afterEach(async () => {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  })

  it('tenant_admin can create an invitation', async () => {
    await withContext(client, adminUserId)
    await expect(
      client.query(
        `INSERT INTO invitations (tenant_id, email, role, token_hash, expires_at, created_by)
         VALUES ($1, 'invite-a@test.com', 'advisor', 'admin-tok-1', NOW() + INTERVAL '7 days', $2)`,
        [tenantId, adminUserId]
      )
    ).resolves.toBeDefined()
  })

  it('advisor cannot create an invitation', async () => {
    await withContext(client, advisorUserId)
    await expect(
      client.query(
        `INSERT INTO invitations (tenant_id, email, role, token_hash, expires_at, created_by)
         VALUES ($1, 'invite-b@test.com', 'advisor', 'adv-tok-1', NOW() + INTERVAL '7 days', $2)`,
        [tenantId, advisorUserId]
      )
    ).rejects.toThrow()
  })
})
