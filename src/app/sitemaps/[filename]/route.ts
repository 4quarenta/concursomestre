import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';
import { getSeoLaunchMode } from '@/services/seo/launchControl';
import { getTrustedRequestOrigin, isProductionSitemapPublicationAllowed } from '@/services/seo/runtimeEnvironment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  if (!isProductionSitemapPublicationAllowed(getSeoLaunchMode(), getTrustedRequestOrigin(request))) {
    return new Response('Sitemap unavailable before SEO production launch', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const { filename } = await context.params;
  const xml = await readStaticSitemapArtifact(filename);
  if (xml === null) {
    return new Response('Not found', {
      status: 404,
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
