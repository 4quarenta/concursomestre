import { SEO_ROBOT_DISALLOW_PATHS } from '@/services/seo/sitemapData';
import { getSeoLaunchMode } from '@/services/seo/launchControl';
import {
  isProductionSitemapPublicationAllowed,
  seoIndexPolicy,
} from '@/services/seo/runtimeEnvironment';
import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const buildRobotsText = (sitemapPublished: boolean): string => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...SEO_ROBOT_DISALLOW_PATHS.map((path) => `Disallow: ${path}`),
  ];
  if (sitemapPublished) {
    lines.push(`Sitemap: ${seoIndexPolicy.canonicalOrigin}${seoIndexPolicy.sitemap.indexPath}`);
  }
  return `${lines.join('\n')}\n`;
};

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

export { buildRobotsText };
