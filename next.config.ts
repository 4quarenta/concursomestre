import path from 'node:path';
import type { NextConfig } from 'next';
import { buildFrontendSecurityHeaders, DEFAULT_FRONTEND_API_BASE_URL } from './src/config/securityHeaders';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildFrontendSecurityHeaders(process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_FRONTEND_API_BASE_URL),
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/questions',
        destination: '/practice',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
