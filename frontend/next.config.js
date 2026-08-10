/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.API_URL || process.env.BACKEND_URL || 'http://127.0.0.1:8000';

const path = require('path');

const nextConfig = {
  output: 'standalone',
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${BACKEND_URL}/static/:path*`,
      },
      {
        source: '/images/:path*',
        destination: `${BACKEND_URL}/images/:path*`,
      },
    ];
  },
  images: {
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
