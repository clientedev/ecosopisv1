/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'acdn-us.mitiendanube.com',
      },
      {
        protocol: 'https',
        hostname: 'ecosopis.com.br',
      }
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['bcrypt'],
  },
  devIndicators: {
    buildActivity: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // On Railway: set API_URL env var to the backend service's internal URL
    // e.g., https://your-backend.up.railway.app  OR  http://backend.railway.internal:PORT
    // Locally: defaults to http://localhost:8000
    const apiUrl = process.env.API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
      {
        source: '/images/:path*',
        destination: `${apiUrl}/images/:path*`,
      },
    ];
  },
};

export default nextConfig;
