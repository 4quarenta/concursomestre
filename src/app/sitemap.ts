import type { MetadataRoute } from 'next';
import { buildSeoSitemapEntries } from '@/services/seo/sitemapData';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await buildSeoSitemapEntries();

  return result.entries.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
