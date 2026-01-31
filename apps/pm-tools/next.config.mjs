/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Remove basePath - let nginx handle path rewriting
  assetPrefix: '/pm',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
