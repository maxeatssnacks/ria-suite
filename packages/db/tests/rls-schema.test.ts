/**
 * CI guard — verifies every tenant-scoped table has RLS ENABLED and FORCED.
 *
 * A table is considered tenant-scoped if it has a `tenant_id` column.
 * Tables intentionally exempt (no tenant_id): tenants, users, modules.
 *
 * If a new table is added with a tenant_id column but RLS is not wired up,
 * this test fails CI before any code reaches production.
 */

import { Client } from 'pg'
import { getConnUrl } from './setup.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let client: Client

beforeAll(async () => {
  client = new Client({ connectionString: getConnUrl() })
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('RLS schema guard', () => {
  it('every table with a tenant_id column has RLS enabled and forced', async () => {
    const result = await client.query<{
      tablename: string
      rowsecurity: boolean
      forcerolesecurity: boolean
    }>(`
      SELECT
        c.relname                        AS tablename,
        c.relrowsecurity                 AS rowsecurity,
        c.relforcerowsecurity            AS forcerolesecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1
          FROM pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname = 'tenant_id'
            AND NOT a.attisdropped
        )
      ORDER BY c.relname
    `)

    const missing = result.rows.filter((r) => !r.rowsecurity || !r.forcerolesecurity)

    if (missing.length > 0) {
      const names = missing.map((r) => {
        const flags = [
          !r.rowsecurity ? 'RLS_NOT_ENABLED' : null,
          !r.forcerolesecurity ? 'RLS_NOT_FORCED' : null,
        ]
          .filter(Boolean)
          .join(', ')
        return `  ${r.tablename}: ${flags}`
      })
      throw new Error(
        `Tables with tenant_id missing RLS:\n${names.join('\n')}\n\nAdd to migration.sql:\n  ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;\n  ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;`
      )
    }

    expect(result.rows.length).toBeGreaterThan(0)
    expect(missing).toHaveLength(0)
  })

  it('app_user role exists with no BYPASSRLS and no SUPERUSER', async () => {
    const result = await client.query<{
      rolname: string
      rolsuper: boolean
      rolbypassrls: boolean
    }>(`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'app_user'
    `)

    expect(result.rows).toHaveLength(1)
    const role = result.rows[0]
    expect(role.rolsuper).toBe(false)
    expect(role.rolbypassrls).toBe(false)
  })
})
