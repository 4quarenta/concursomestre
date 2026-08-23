import { NextResponse } from 'next/server';
import { getSeoLaunchMode } from '@/services/seo/launchControl';
import { isProductionSitemapPublicationAllowed, seoIndexPolicy } from '@/services/seo/runtimeEnvironment';

/**
 * Stable sitemap index endpoint. Additional segmented sitemap files can be
 * added here without changing the URL submitted to search engines.
 */
export function GET(request: Request) {
  if (!isProductionSitemapPublicationAllowed(getSeoLaunchMode(), new URL(request.url).origin)) {
    return new NextResponse('Sitemap unavailable before SEO production launch', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  return NextResponse.redirect(`${seoIndexPolicy.canonicalOrigin}${seoIndexPolicy.sitemap.indexPath}`, 308);
}

export const HEAD = GET;
