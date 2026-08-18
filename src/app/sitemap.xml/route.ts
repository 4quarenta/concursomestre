import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';
import { isSeoProductionMode } from '@services/seo/launchControl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!isSeoProductionMode()) {
    return new Response('Sitemap unavailable before SEO production launch', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const xml = await readStaticSitemapArtifact('sitemap.xml');
  if (xml === null) {
    return new Response('Sitemap unavailable', { status: 503 });
  }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
