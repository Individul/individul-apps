/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/termene',
  assetPrefix: '/termene',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003',
  },
}

module.exports = nextConfig
