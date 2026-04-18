import { buildQuestionSitemapPageUrl, buildSitemapIndexXml, getQuestionSitemapPageSize, loadPublicQuestionPage } from '@/lib/publicQuestionSitemap';

export const revalidate = 3600;

export async function GET() {
  const pageSize = getQuestionSitemapPageSize();
  const firstPage = await loadPublicQuestionPage(1, pageSize);
  const totalPages = Math.max(1, Math.ceil((firstPage.total || 0) / pageSize));
  const sitemapUrls = Array.from({ length: totalPages }, (_, index) => buildQuestionSitemapPageUrl(index + 1));
  const xml = buildSitemapIndexXml(sitemapUrls.length > 0 ? sitemapUrls : [buildQuestionSitemapPageUrl(1)]);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
