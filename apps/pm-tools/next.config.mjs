/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/pm',
  assetPrefix: '/pm',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
