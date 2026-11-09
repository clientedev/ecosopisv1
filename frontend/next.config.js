/** @type {import('next').NextConfig} */
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://web-production-33f04.up.railway.app'
    : (process.env.BACKEND_URL && !process.env.BACKEND_URL.includes('localhost') && !process.env.BACKEND_URL.includes('127.0.0.1')
        ? process.env.BACKEND_URL
        : 'https://web-production-33f04.up.railway.app');

const path = require('path');

const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  swcMinify: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'bufferutil', 'utf-8-validate'],
  },
  webpack: (config, { dev }) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'localhost',
    '*.replit.dev',
    '*.janeway.replit.dev',
    '*.spock.replit.dev',
    '*.pike.replit.dev',
    '*.repl.co',
    '*.replit.app',
  ],
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2|ttf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/produto/:slug/info',
        destination: '/produtos/:slug',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${BACKEND_URL}/api/:path*`,
        },
        {
          source: '/static/:path*',
          destination: `${BACKEND_URL}/static/:path*`,
        },
        {
          source: '/images/:path*',
          destination: `${BACKEND_URL}/images/:path*`,
        },
      ],
    };
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 604800,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/static/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
