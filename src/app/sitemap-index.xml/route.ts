import { NextResponse } from 'next/server';
import { buildSiteUrl } from '@/config/siteUrl';

/**
 * Stable sitemap index endpoint. Additional segmented sitemap files can be
 * added here without changing the URL submitted to search engines.
 */
export function GET() {
  return NextResponse.redirect(buildSiteUrl('/sitemap.xml'), 308);
}
