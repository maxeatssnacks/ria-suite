import EmbeddedPostgres from 'embedded-postgres'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

let pg: EmbeddedPostgres

const DB_NAME = 'ria_test'
const PG_PORT = 54321

// Apply every migration under prisma/migrations/ in sorted order, mirroring Prisma's apply sequence.
async function applyMigrations(client: Client) {
  const migrationsDir = join(import.meta.dirname, '../prisma/migrations')
  const dirs = readdirSync(migrationsDir)
    .filter((d) => !d.endsWith('.toml'))
    .sort()
  for (const dir of dirs) {
    const sql = readFileSync(join(migrationsDir, dir, 'migration.sql'), 'utf8')
    await client.query(sql)
  }
}

// Start postgres once for the whole test run.
// vitest runs all files in a single fork (singleFork: true), so this runs once.
beforeAll(async () => {
  pg = new EmbeddedPostgres({
    databaseDir: `/tmp/ria-test-pg-${process.pid}`,
    user: 'postgres',
    password: 'postgres',
    port: PG_PORT,
    persistent: false,
  })

  await pg.initialise()
  await pg.start()
  await pg.createDatabase(DB_NAME)

  const connUrl = `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`
  process.env.DATABASE_URL = connUrl
  process.env.DIRECT_URL = connUrl

  const client = new Client({ connectionString: connUrl })
  await client.connect()
  try {
    await applyMigrations(client)

    // Grant app_user login for direct-connect tests (NOLOGIN in prod; tests connect as
    // postgres and SET LOCAL ROLE).
    await client.query(`ALTER ROLE app_user LOGIN PASSWORD 'app_user_test'`)

    // Create a non-superuser connector role that mirrors hosted Postgres privileges
    // (e.g. Supabase's "postgres" role). It must rely on the membership grant from
    // the migration to perform SET LOCAL ROLE app_user — the key invariant under test.
    await client.query(
      `CREATE ROLE app_connect LOGIN PASSWORD 'app_connect_test' NOSUPERUSER NOCREATEDB NOCREATEROLE`
    )
    await client.query(`GRANT app_user TO app_connect`)
  } finally {
    await client.end()
  }
}, 30_000)

afterAll(async () => {
  await pg?.stop()
})

// Exported helpers for use in test files.
export function getConnUrl() {
  return process.env.DATABASE_URL!
}

export function getAppUserConnUrl() {
  return `postgresql://app_user:app_user_test@localhost:${PG_PORT}/${DB_NAME}`
}

// Non-superuser connector URL — mirrors the hosted Postgres connecting role.
// Must use SET LOCAL ROLE app_user (relying on the membership grant) to access tenant data.
export function getConnectorConnUrl() {
  return `postgresql://app_connect:app_connect_test@localhost:${PG_PORT}/${DB_NAME}`
}
