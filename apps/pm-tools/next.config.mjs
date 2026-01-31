/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone for now to debug - run with next start
  basePath: '/pm',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
