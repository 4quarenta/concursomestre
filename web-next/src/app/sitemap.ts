import type { MetadataRoute } from 'next';
import { websiteManifest } from '@/config/platform';
import { loadPublicMarketingPageData } from '@/lib/publicMarketing';

const PUBLIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/planos', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/elite', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = websiteManifest.website.canonicalUrl.replace(/\/$/, '');
  const lastModified = new Date();
  const { settings } = await loadPublicMarketingPageData('planos');
  const dynamicLandingRoutes = (settings.landingPages || [])
    .filter((landing) => landing.status === 'published')
    .map((landing) => landing.slug)
    .filter((slug) => slug !== 'planos' && slug !== 'elite')
    .map((slug) => ({
      path: `/l/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  return [...PUBLIC_ROUTES, ...dynamicLandingRoutes].map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
