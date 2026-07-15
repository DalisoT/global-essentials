/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // In Next.js 14, serverActions lives under `experimental`. It was
  // promoted to a top-level key in Next.js 15. The 10MB limit lets
  // image-upload server actions (lib/actions/inventory.ts → uploadProductImages)
  // accept reasonably large files without hitting the default 1MB cap.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;