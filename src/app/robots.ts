import type { MetadataRoute } from 'next';
import { buildSiteUrl, getConfiguredSiteUrl } from '@/config/siteUrl';
import { SEO_ROBOT_DISALLOW_PATHS } from '@/services/seo/sitemapData';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getConfiguredSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: SEO_ROBOT_DISALLOW_PATHS,
    },
    sitemap: [
      buildSiteUrl('/sitemap.xml', siteUrl),
      buildSiteUrl('/sitemaps/blog-sitemap.xml', siteUrl),
    ],
    host: siteUrl.origin,
  };
}
