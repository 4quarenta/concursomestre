/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { buildSiteUrl } from '@/config/siteUrl';
import { fetchBlogPageForServer } from '../blogServerData';

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export async function GET() {
  const page = await fetchBlogPageForServer();
  const items = page.items.map((article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(buildSiteUrl(`/blog/${article.slug}`))}</link>
      <guid isPermaLink="true">${escapeXml(buildSiteUrl(`/blog/${article.slug}`))}</guid>
      <description>${escapeXml(article.excerpt)}</description>
      <pubDate>${new Date(article.publishedAt || article.createdAt).toUTCString()}</pubDate>
      <category>${escapeXml(article.category.name)}</category>
      <author>${escapeXml(article.author.name)}</author>
    </item>`).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog ConcursoMestre</title>
    <link>${escapeXml(buildSiteUrl('/blog'))}</link>
    <description>Notícias, editais e análises para concursos públicos.</description>
    <language>pt-BR</language>${items}
  </channel>
</rss>`, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
