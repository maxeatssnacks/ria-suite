/**
 * check-rls.ts — CI introspection script.
 *
 * Connects to DATABASE_URL and reports any tables with a tenant_id column
 * that are missing ENABLE ROW LEVEL SECURITY or FORCE ROW LEVEL SECURITY.
 *
 * Exits with code 1 if any violations are found (fails CI).
 *
 * Usage: tsx scripts/check-rls.ts
 */

import { Client } from 'pg'

const connUrl = process.env.DATABASE_URL
if (!connUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const client = new Client({ connectionString: connUrl })
await client.connect()

try {
  const result = await client.query<{
    tablename: string
    rowsecurity: boolean
    forcerolesecurity: boolean
  }>(`
    SELECT
      c.relname             AS tablename,
      c.relrowsecurity      AS rowsecurity,
      c.relforcerowsecurity AS forcerolesecurity
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

  if (missing.length === 0) {
    console.log(`✓ All ${result.rows.length} tenant-scoped table(s) have RLS enabled and forced.`)
    process.exit(0)
  }

  console.error('✗ Tables with tenant_id missing RLS configuration:\n')
  for (const r of missing) {
    const flags = [
      !r.rowsecurity ? 'RLS_NOT_ENABLED' : null,
      !r.forcerolesecurity ? 'RLS_NOT_FORCED' : null,
    ]
      .filter(Boolean)
      .join(', ')
    console.error(`  ${r.tablename}: ${flags}`)
  }
  console.error(
    '\nFix: add to the migration SQL:\n  ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;\n  ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;'
  )
  process.exit(1)
} finally {
  await client.end()
}
