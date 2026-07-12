import { buildSeoSitemapEntries } from '@/services/seo/sitemapData';

const MAX_URLS_PER_SITEMAP = 45_000;
const KINDS = new Set(['institutional', 'questions', 'rankings', 'materials', 'landings']);

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[character] || character));

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; page: string }> }) {
  const { kind, page } = await params;
  const batch = Math.max(1, Number.parseInt(page, 10) || 1);
  if (!KINDS.has(kind)) return new Response('Not found', { status: 404 });
  const entries = (await buildSeoSitemapEntries()).entries.filter((entry) => entry.category === kind);
  const rows = entries.slice((batch - 1) * MAX_URLS_PER_SITEMAP, batch * MAX_URLS_PER_SITEMAP);
  if (rows.length === 0 && batch > 1) return new Response('Not found', { status: 404 });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map((entry) => `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastModified.toISOString()}</lastmod></url>`).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' } });
}
