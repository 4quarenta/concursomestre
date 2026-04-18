import { buildQuestionSitemapEntries, buildUrlSetXml, getQuestionSitemapPageSize, loadPublicQuestionPage } from '@/lib/publicQuestionSitemap';

export const revalidate = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageNumber = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
  const pageSize = getQuestionSitemapPageSize();
  const questionPage = await loadPublicQuestionPage(pageNumber, pageSize);
  const xml = buildUrlSetXml(buildQuestionSitemapEntries(questionPage.rows));

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
