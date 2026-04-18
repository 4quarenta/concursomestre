import { buildQuestionSitemapPageUrl } from '@/lib/publicQuestionSitemap';

export const revalidate = 3600;

const extractPageFromPathname = (pathname: string) => {
  const match = pathname.match(/\/question-sitemap\/(\d+)\.xml$/);
  return Math.max(1, Number(match?.[1] || '1') || 1);
};

export async function GET(request: Request, context?: { params?: Promise<{ page?: string }> | { page?: string } }) {
  const pathname = new URL(request.url).pathname;
  const params = context?.params ? await Promise.resolve(context.params) : undefined;
  const pageNumber = Math.max(1, Number(params?.page || extractPageFromPathname(pathname)) || 1);

  return Response.redirect(buildQuestionSitemapPageUrl(pageNumber), 308);
}

export async function HEAD(request: Request, context?: { params?: Promise<{ page?: string }> | { page?: string } }) {
  const response = await GET(request, context);
  return new Response(null, {
    status: response.status,
    headers: {
      Location: response.headers.get('Location') || buildQuestionSitemapPageUrl(1),
    },
  });
}
