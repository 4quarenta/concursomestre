import type { MetadataRoute } from 'next';
import { websiteManifest } from '@/config/platform';
import { loadPublicMarketingPageData } from '@/lib/publicMarketing';
import { loadPublicMaterials } from '@/lib/publicMaterials';
import { loadPublicPromotionPageData } from '@/lib/publicPromotion';
import { loadPublicRankings } from '@/lib/publicRankings';
import { buildMaterialPath, buildRankingPath } from '@/services/seo/slug';

type SitemapRouteConfig = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
  lastModified?: Date;
};

const PUBLIC_ROUTES: SitemapRouteConfig[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/planos', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/elite', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/checkout/termos-de-adesao', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

const getDynamicSitemapLimit = () => {
  const parsedLimit = Number(process.env.WEB_NEXT_SITEMAP_DYNAMIC_LIMIT || 200);
  return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 200;
};

const resolveTimestampDate = (timestamp?: number) => {
  if (!timestamp) {
    return undefined;
  }

  const milliseconds = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = websiteManifest.website.canonicalUrl.replace(/\/$/, '');
  const lastModified = new Date();
  const dynamicLimit = getDynamicSitemapLimit();
  const [{ settings }, promotionData, rankings, materials] = await Promise.all([
    loadPublicMarketingPageData('planos'),
    loadPublicPromotionPageData(),
    loadPublicRankings(),
    loadPublicMaterials(),
  ]);
  const dynamicLandingRoutes = (settings.landingPages || [])
    .filter((landing) => landing.status === 'published')
    .map((landing) => landing.slug)
    .filter((slug) => slug !== 'planos' && slug !== 'elite')
    .map<SitemapRouteConfig>((slug) => ({
      path: `/l/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  const rankingRoutes = rankings
    .filter((ranking) => !ranking.status || ranking.status === 'approved')
    .slice(0, dynamicLimit)
    .map<SitemapRouteConfig>((ranking) => ({
      path: buildRankingPath(ranking),
      changeFrequency: 'daily',
      priority: 0.7,
      lastModified: resolveTimestampDate(ranking.createdAt),
    }));
  const materialRoutes = materials
    .filter((material) => !material.status || material.status === 'approved')
    .slice(0, dynamicLimit)
    .map<SitemapRouteConfig>((material) => ({
      path: buildMaterialPath(material),
      changeFrequency: 'weekly',
      priority: 0.6,
      lastModified: resolveTimestampDate(material.createdAt),
    }));
  const promoRoutes: SitemapRouteConfig[] = promotionData.isEnabled && promotionData.promotion.slug
    ? [{
      path: `/promo/${promotionData.promotion.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }]
    : [];

  return [...PUBLIC_ROUTES, ...dynamicLandingRoutes, ...rankingRoutes, ...materialRoutes, ...promoRoutes].map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: route.lastModified || lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
