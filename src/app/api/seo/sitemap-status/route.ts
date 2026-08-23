import { NextResponse } from 'next/server';
import { readStaticSitemapStatus } from '@/services/seo/staticSitemapArtifacts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const payload = await readStaticSitemapStatus();
  if (payload === null) {
    return NextResponse.json({ success: false, message: 'Sitemap status unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
