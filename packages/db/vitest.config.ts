import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // Single thread: EmbeddedPostgres is stateful; parallel files would race.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60_000,
  },
})
