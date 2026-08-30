import { getSeoLaunchMode } from '@/services/seo/launchControl';
import {
  isProductionSitemapPublicationAllowed,
} from '@/services/seo/runtimeEnvironment';
import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';
import { buildRobotsText } from '@/services/seo/robotsText';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const publicationAllowed = isProductionSitemapPublicationAllowed(getSeoLaunchMode(), requestOrigin);
  const sitemapPublished = publicationAllowed
    && await readStaticSitemapArtifact('sitemap.xml') !== null;
  return new Response(buildRobotsText(sitemapPublished), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const HEAD = GET;
