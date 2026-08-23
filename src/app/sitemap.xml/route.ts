import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';
import { getSeoLaunchMode } from '@services/seo/launchControl';
import { isProductionSitemapPublicationAllowed } from '@services/seo/runtimeEnvironment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isProductionSitemapPublicationAllowed(getSeoLaunchMode(), new URL(request.url).origin)) {
    return new Response('Sitemap unavailable before SEO production launch', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const xml = await readStaticSitemapArtifact('sitemap.xml');
  if (xml === null) {
    return new Response('Sitemap unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const HEAD = GET;
