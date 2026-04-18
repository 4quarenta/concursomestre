import type { MetadataRoute } from 'next';
import { websiteManifest } from '@/config/platform';
import { buildQuestionSitemapIndexUrl } from '@/lib/publicQuestionSitemap';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = websiteManifest.website.canonicalUrl.replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/checkout/termos-de-adesao'],
      disallow: ['/auth', '/dashboard', '/admin', '/profile', '/checkout/'],
    },
    sitemap: [`${baseUrl}/sitemap.xml`, buildQuestionSitemapIndexUrl()],
    host: baseUrl,
  };
}
