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

export interface SitemapCoverageBucket {
  total: number;
  indexed: number;
  missing: number;
}

export interface SitemapStatusPayload {
  scope?: string;
  generatedAt: string;
  canonicalBaseUrl: string;
  sitemapUrl: string;
  robotsUrl: string;
  totalUrls: number;
  coverage: {
    institutional: SitemapCoverageBucket;
    questions: SitemapCoverageBucket;
    boards: SitemapCoverageBucket;
    rankings: SitemapCoverageBucket;
    materials: SitemapCoverageBucket;
  };
  missingSamples: {
    questions: string[];
    boards: string[];
    rankings: string[];
    materials: string[];
  };
  note?: string;
}

const SITEMAP_STATUS_URL = '/api/seo/sitemap-status';

export const seoService = {
  async getSitemapStatus(): Promise<SitemapStatusPayload | null> {
    try {
      const response = await fetch(SITEMAP_STATUS_URL, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return null;
      }

      return await response.json() as SitemapStatusPayload;
    } catch {
      return null;
    }
  },
};

export default seoService;
