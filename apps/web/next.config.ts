import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Our workspace packages ship raw TS; Next transpiles them in-tree.
  transpilePackages: ['@ria/ui', '@ria/db', '@ria/core', '@ria/audit'],

  // `@prisma/client` is in Next's default `serverExternalPackages` list and MUST
  // stay external — it loads a native query-engine binary that cannot be bundled.
  // Because it's external, Next emits a runtime `require('@prisma/client')` that
  // Node resolves from THIS app's directory (apps/web), not from @ria/db where it
  // is imported. Under pnpm's isolated node_modules that require fails unless the
  // package is a direct dependency of apps/web. Hence `@prisma/client` (+ the
  // `prisma` CLI it peers with) are declared in apps/web/package.json even though
  // no app code imports them directly. See PROGRESS.md "Part C — Follow-up:
  // Prisma monorepo resolution".
}

export default nextConfig
