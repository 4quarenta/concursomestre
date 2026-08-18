import type { MetadataRoute } from 'next';
import { buildSiteUrl, getConfiguredSiteUrl } from '@/config/siteUrl';
import { SEO_ROBOT_DISALLOW_PATHS } from '@/services/seo/sitemapData';
import { isSeoProductionMode } from '@services/seo/launchControl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getConfiguredSiteUrl();
  const production = isSeoProductionMode();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: SEO_ROBOT_DISALLOW_PATHS,
    },
    ...(production ? {
      sitemap: [
        buildSiteUrl('/sitemap.xml', siteUrl),
        buildSiteUrl('/sitemaps/blog-sitemap.xml', siteUrl),
      ],
    } : {}),
    host: siteUrl.origin,
  };
}
