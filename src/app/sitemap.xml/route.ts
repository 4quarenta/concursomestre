import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
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
