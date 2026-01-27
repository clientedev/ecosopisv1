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
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8000').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const protocol = (process.env.NEXT_PUBLIC_API_URL || '').startsWith('https') ? 'https' : 'http';
    
    return [
      {
        source: '/api/:path*',
        destination: `${protocol}://${apiUrl}/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${protocol}://${apiUrl}/static/:path*`,
      },
      {
        source: '/images/:path*',
        destination: `${protocol}://${apiUrl}/images/:path*`,
      },
    ];
  },
};

export default nextConfig;
