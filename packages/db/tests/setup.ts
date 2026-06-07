import EmbeddedPostgres from 'embedded-postgres'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

let pg: EmbeddedPostgres

const DB_NAME = 'ria_test'
const PG_PORT = 54321

async function runMigration(client: Client) {
  const sql = readFileSync(
    join(import.meta.dirname, '../prisma/migrations/20260607000000_initial/migration.sql'),
    'utf8'
  )
  await client.query(sql)
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
    await runMigration(client)
    // Grant app_user login for tests (it's NOLOGIN in prod; tests connect as postgres and SET ROLE)
    await client.query(`ALTER ROLE app_user LOGIN PASSWORD 'app_user_test'`)
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
