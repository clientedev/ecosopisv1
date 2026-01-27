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
    return [
      {
        source: '/api/:path*',
        destination: `https://web-production-33f04.up.railway.app/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `https://web-production-33f04.up.railway.app/static/:path*`,
      },
      {
        source: '/images/:path*',
        destination: `https://web-production-33f04.up.railway.app/images/:path*`,
      },
    ];
  },
};

export default nextConfig;
