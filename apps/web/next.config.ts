import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@ria/ui', '@ria/db', '@ria/core', '@ria/audit'],
}

export default nextConfig
