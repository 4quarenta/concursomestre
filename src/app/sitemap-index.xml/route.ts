import { buildSiteUrl, getConfiguredSiteUrl } from '@/config/siteUrl';

export const dynamic = 'force-dynamic';

/**
 * Stable sitemap index endpoint. Additional segmented sitemap files can be
 * added here without changing the URL submitted to search engines.
 */
export async function GET() {
  const siteUrl = getConfiguredSiteUrl();
  const sitemapUrl = buildSiteUrl('/sitemap.xml', siteUrl);
  const lastModified = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${sitemapUrl}</loc><lastmod>${lastModified}</lastmod></sitemap>\n</sitemapindex>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
