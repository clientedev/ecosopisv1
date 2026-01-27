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
    const apiUrl = 'https://web-production-33f04.up.railway.app';
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
