import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      {
        source: '/plans',
        destination: '/planos',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
