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

import { apiClient, assertApiSuccess, readApiData } from '@services/api';

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

const SITEMAP_STATUS_URL = 'admin/sitemap-status.php';

export const seoService = {
  async getSitemapStatus(): Promise<SitemapStatusPayload | null> {
    try {
      const response = await apiClient.get(SITEMAP_STATUS_URL, {
        headers: { 'Cache-Control': 'no-store' },
      });
      assertApiSuccess(response, 'Não foi possível carregar o status do sitemap.');
      return readApiData<SitemapStatusPayload | null>(response, null);
    } catch {
      return null;
    }
  },
};

export default seoService;
