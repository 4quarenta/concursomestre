import type { Question } from '@/types';
import { safeServerFetch } from '@/lib/api';
import { buildAbsoluteUrl, buildQuestionPath } from '@/services/seo/slug';

export interface PublicQuestionPageResult {
  rows: Question[];
  total: number;
}

const DEFAULT_QUESTION_SITEMAP_PAGE_SIZE = 500;

const normalizeQuestionPagePayload = (payload: unknown): PublicQuestionPageResult => {
  if (Array.isArray(payload)) {
    return {
      rows: payload as Question[],
      total: payload.length,
    };
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    const rows = Array.isArray(objectPayload.rows)
      ? objectPayload.rows as Question[]
      : [];
    const total = Number(objectPayload.total || rows.length || 0);

    return {
      rows,
      total,
    };
  }

  return {
    rows: [],
    total: 0,
  };
};

export const getQuestionSitemapPageSize = () => {
  const parsed = Number(process.env.WEB_NEXT_QUESTION_SITEMAP_PAGE_SIZE || DEFAULT_QUESTION_SITEMAP_PAGE_SIZE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUESTION_SITEMAP_PAGE_SIZE;
};

export const loadPublicQuestionPage = async (
  page = 1,
  limit = getQuestionSitemapPageSize(),
): Promise<PublicQuestionPageResult> => {
  const payload = await safeServerFetch<unknown>(`questionsList?page=${page}&limit=${limit}`, {
    rows: [],
    total: 0,
  });

  return normalizeQuestionPagePayload(payload);
};

export const buildQuestionSitemapPageUrl = (page: number) =>
  buildAbsoluteUrl(`/question-sitemap-page.xml?page=${page}`);

export const buildQuestionSitemapIndexUrl = () =>
  buildAbsoluteUrl('/question-sitemap.xml');

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildSitemapIndexXml = (urls: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join('\n')}
</sitemapindex>`;

export const buildUrlSetXml = (
  entries: Array<{ url: string; lastModified?: string }>,
) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url><loc>${escapeXml(entry.url)}</loc>${entry.lastModified ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;

export const buildQuestionSitemapEntries = (questions: Question[]) =>
  questions
    .filter((question) => question.id && (question.enunciado || question.enunciado_clean))
    .map((question) => ({
      url: buildAbsoluteUrl(buildQuestionPath(question)),
      lastModified: question.timestamp || undefined,
    }));
