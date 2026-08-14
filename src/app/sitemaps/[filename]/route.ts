import { readStaticSitemapArtifact } from '@/services/seo/staticSitemapArtifacts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const xml = await readStaticSitemapArtifact(filename);
  if (xml === null) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900',
    },
  });
}
