import { SEO_ROBOT_DISALLOW_PATHS } from '@/services/seo/sitemapData';
import { seoIndexPolicy } from '@/services/seo/runtimeEnvironment';

export const buildRobotsText = (sitemapPublished: boolean): string => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...SEO_ROBOT_DISALLOW_PATHS.map((path) => `Disallow: ${path}`),
  ];
  if (sitemapPublished) {
    lines.push(`Sitemap: ${seoIndexPolicy.canonicalOrigin}${seoIndexPolicy.sitemap.indexPath}`);
  }
  return `${lines.join('\n')}\n`;
};
