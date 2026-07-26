/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite backup-uri mai mari la restaurare (upload prin server action).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
export default nextConfig;
