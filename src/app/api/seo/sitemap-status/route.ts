import { NextResponse } from 'next/server';
import { buildSeoSitemapStatus } from '@/services/seo/sitemapData';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await buildSeoSitemapStatus();

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
