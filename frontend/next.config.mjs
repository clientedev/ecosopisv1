/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8000'}/:path*`,
      },
      {
        source: '/static/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8000'}/static/uploads/:path*`,
      },
      {
        source: '/static/attached_assets/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8000'}/static/attached_assets/:path*`,
      },
    ];
  },
};

export default nextConfig;
