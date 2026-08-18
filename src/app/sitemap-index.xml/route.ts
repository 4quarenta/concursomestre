import { NextResponse } from 'next/server';
import { buildSiteUrl } from '@/config/siteUrl';
import { isSeoProductionMode } from '@/services/seo/launchControl';

/**
 * Stable sitemap index endpoint. Additional segmented sitemap files can be
 * added here without changing the URL submitted to search engines.
 */
export function GET() {
  if (!isSeoProductionMode()) {
    return new NextResponse('Sitemap unavailable before SEO production launch', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  return NextResponse.redirect(buildSiteUrl('/sitemap.xml'), 308);
}
