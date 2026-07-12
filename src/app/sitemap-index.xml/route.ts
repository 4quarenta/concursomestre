import { buildSiteUrl, getConfiguredSiteUrl } from '@/config/siteUrl';
import { buildSeoSitemapEntries } from '@/services/seo/sitemapData';

export const dynamic = 'force-dynamic';

/**
 * Stable sitemap index endpoint. Additional segmented sitemap files can be
 * added here without changing the URL submitted to search engines.
 */
export async function GET() {
  const siteUrl = getConfiguredSiteUrl();
  const result = await buildSeoSitemapEntries();
  const lastModified = new Date().toISOString();
  const kinds = ['institutional', 'questions', 'rankings', 'materials', 'landings'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${kinds.filter((kind) => result.entries.some((entry) => entry.category === kind)).map((kind) => `  <sitemap><loc>${buildSiteUrl(`/sitemaps/${kind}/1`, siteUrl)}</loc><lastmod>${lastModified}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
