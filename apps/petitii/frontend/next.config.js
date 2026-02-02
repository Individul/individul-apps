/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/petitii',
  assetPrefix: '/petitii',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002',
  },
}

module.exports = nextConfig
