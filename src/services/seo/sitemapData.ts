import type { MarketingLandingPage, Material, Question, Ranking } from '@types';
import { buildMaterialPath, buildQuestionPath, buildRankingPath } from './slug';
import { buildSiteUrl, getConfiguredSiteUrl } from '../../config/siteUrl';
import { resolveAbsoluteApiBaseUrl } from '../api/baseUrl';
import { isQuestionPubliclyVisible } from '../questions/questionPublication';
import { buildMarketingLandingPath, mergeMarketingLandingPages, normalizeLandingSlug } from '../marketing/landingPages';

type SitemapCategory = 'institutional' | 'questions' | 'rankings' | 'materials' | 'landings';
type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface SeoSitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
  category: SitemapCategory;
}

export interface SitemapCoverageBucket {
  total: number;
  indexed: number;
  missing: number;
}

export interface SeoSitemapStatusPayload {
  scope: 'sitemap_coverage';
  generatedAt: string;
  canonicalBaseUrl: string;
  sitemapUrl: string;
  robotsUrl: string;
  totalUrls: number;
  coverage: Record<SitemapCategory, SitemapCoverageBucket>;
  missingSamples: Record<Exclude<SitemapCategory, 'institutional'>, string[]>;
  note: string;
}

interface EntryBuildResult {
  indexedEntries: SeoSitemapEntry[];
  missingLabels: string[];
  total: number;
}

interface SeoSitemapBuildResult {
  entries: SeoSitemapEntry[];
  coverage: SeoSitemapStatusPayload['coverage'];
  missingSamples: SeoSitemapStatusPayload['missingSamples'];
}

const QUESTION_PAGE_LIMIT = 500;
const MAX_QUESTION_PAGES = 100;
const FETCH_TIMEOUT_MS = 5000;

export const SEO_PUBLIC_ROUTES = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/planos', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/concursos', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/lei-comentada', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/elite', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/marketplace', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/changelog', changeFrequency: 'monthly', priority: 0.45 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.35 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.35 },
  { path: '/checkout/termos-de-adesao', changeFrequency: 'yearly', priority: 0.25 },
] satisfies Array<{ path: string; changeFrequency: ChangeFrequency; priority: number }>;

export const SEO_ROBOT_DISALLOW_PATHS = [
  '/admin',
  '/auth',
  '/confirm-email',
  '/cronograma',
  '/dashboard',
  '/bank-analysis',
  '/flashcards',
  '/notifications',
  '/partner-dashboard',
  '/performance/',
  '/plans',
  '/practice',
  '/profile',
  '/read/',
  '/reset-password',
  '/simulation',
  '/subscription/',
  '/support',
  '/x-ray',
  '/api/',
];

const stripHtml = (value: unknown) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const normalizePublicationToken = (value: unknown) => String(value || '').trim().toLowerCase();
const RESERVED_MARKETING_LANDING_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'practice',
  'profile',
  'read',
  'reset-password',
  'subscription',
  'support',
  'uploads',
  'storage',
]);
const isReservedMarketingLandingSlug = (slug: string) => (
  RESERVED_MARKETING_LANDING_SLUGS.has(slug)
  || Array.from(RESERVED_MARKETING_LANDING_SLUGS).some((reservedSlug) => slug.startsWith(`${reservedSlug}-`))
);

export const isQuestionEligibleForPublicSitemap = (question: Question) => isQuestionPubliclyVisible(question);

export const isMaterialEligibleForPublicSitemap = (material: Material) => {
  const status = normalizePublicationToken((material as { status?: unknown }).status);

  if (!status) {
    return true;
  }

  return ['approved', 'published', 'publicado', 'active', 'ativo'].includes(status);
};

export const isRankingEligibleForPublicSitemap = (ranking: Ranking) => {
  const status = normalizePublicationToken((ranking as { status?: unknown }).status);

  if (!status) {
    return true;
  }

  return ['approved', 'published', 'publicado', 'active', 'ativo'].includes(status);
};

export const isMarketingLandingEligibleForPublicSitemap = (landing: MarketingLandingPage) => {
  if (normalizePublicationToken(landing.status) !== 'published') {
    return false;
  }

  const slug = normalizeLandingSlug(landing.slug);
  if (!slug || ['planos', 'elite'].includes(slug) || isReservedMarketingLandingSlug(slug)) {
    return false;
  }

  return buildMarketingLandingPath(slug).startsWith('/l/');
};

const readEnv = (key: string): string => {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }

  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = () => resolveAbsoluteApiBaseUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || undefined,
);

const readEnvelopeData = <TData,>(payload: unknown, fallback: TData): TData => {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return ((payload as { data?: TData }).data ?? fallback);
  }

  return (payload ?? fallback) as TData;
};

const fetchJson = async (endpoint: string): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(endpoint, getApiBaseUrl()).toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SEO fetch failed for ${endpoint}: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const fetchList = async <TItem,>(endpoint: string): Promise<TItem[]> => {
  try {
    const payload = readEnvelopeData<unknown>(await fetchJson(endpoint), []);
    return Array.isArray(payload) ? payload as TItem[] : [];
  } catch {
    return [];
  }
};

const fetchMarketingLandingPages = async (): Promise<MarketingLandingPage[]> => {
  try {
    const payload = readEnvelopeData<Record<string, unknown>>(await fetchJson('settings.php'), {});
    const siteName = String(payload.siteName || 'ConcursoMestre').trim();
    const landingPages = Array.isArray(payload.landingPages) ? payload.landingPages : undefined;
    return mergeMarketingLandingPages(landingPages, siteName);
  } catch {
    return [];
  }
};

const fetchAllQuestions = async (): Promise<Question[]> => {
  const questions: Question[] = [];
  let currentPage = 1;
  let total = Number.POSITIVE_INFINITY;

  try {
    while (questions.length < total && currentPage <= MAX_QUESTION_PAGES) {
      const url = new URL('questionsList', getApiBaseUrl());
      url.searchParams.set('page', String(currentPage));
      url.searchParams.set('limit', String(QUESTION_PAGE_LIMIT));

      const payload = readEnvelopeData<{ rows?: Question[]; total?: number }>(
        await fetchJson(url.toString()),
        { rows: [], total: 0 },
      );
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      total = Number(payload.total || rows.length || 0);

      if (rows.length === 0) {
        break;
      }

      questions.push(...rows);
      currentPage += 1;
    }
  } catch {
    return questions;
  }

  return questions;
};

const createCoverageBucket = (total: number, indexed: number): SitemapCoverageBucket => ({
  total,
  indexed,
  missing: Math.max(total - indexed, 0),
});

const createEntry = (
  path: string,
  category: SitemapCategory,
  changeFrequency: ChangeFrequency,
  priority: number,
  now: Date,
): SeoSitemapEntry => ({
  url: buildSiteUrl(path),
  lastModified: now,
  changeFrequency,
  priority,
  category,
});

const buildDynamicEntries = <TItem,>(
  items: TItem[],
  getId: (item: TItem) => unknown,
  getPath: (item: TItem) => string,
  getLabel: (item: TItem) => string,
  category: SitemapCategory,
  now: Date,
): EntryBuildResult => {
  const indexedEntries: SeoSitemapEntry[] = [];
  const missingLabels: string[] = [];

  for (const item of items) {
    const id = getId(item);

    if (id === undefined || id === null || id === '') {
      missingLabels.push(getLabel(item));
      continue;
    }

    indexedEntries.push(createEntry(getPath(item), category, 'weekly', 0.6, now));
  }

  return {
    indexedEntries,
    missingLabels,
    total: items.length,
  };
};

export const buildSeoSitemapEntries = async (): Promise<SeoSitemapBuildResult> => {
  const now = new Date();
  const [questions, rankings, materials, landingPages] = await Promise.all([
    fetchAllQuestions(),
    fetchList<Ranking>('rankingsList'),
    fetchList<Material>('materialsList'),
    fetchMarketingLandingPages(),
  ]);

  const institutionalEntries = SEO_PUBLIC_ROUTES.map((route) =>
    createEntry(route.path, 'institutional', route.changeFrequency, route.priority, now));
  const publicQuestions = questions.filter(isQuestionEligibleForPublicSitemap);
  const publicRankings = rankings.filter(isRankingEligibleForPublicSitemap);
  const publicMaterials = materials.filter(isMaterialEligibleForPublicSitemap);
  const publicLandings = landingPages.filter(isMarketingLandingEligibleForPublicSitemap);
  const questionResult = buildDynamicEntries(
    publicQuestions,
    (question) => question.id,
    buildQuestionPath,
    (question) => stripHtml(question.enunciado_clean || question.enunciado || `questao-sem-id`),
    'questions',
    now,
  );
  const rankingResult = buildDynamicEntries(
    publicRankings,
    (ranking) => ranking.id,
    buildRankingPath,
    (ranking) => ranking.name || ranking.institution || 'ranking-sem-id',
    'rankings',
    now,
  );
  const materialResult = buildDynamicEntries(
    publicMaterials,
    (material) => material.id,
    buildMaterialPath,
    (material) => material.title || material.description || 'material-sem-id',
    'materials',
    now,
  );
  const landingResult = buildDynamicEntries(
    publicLandings,
    (landing) => landing.id || landing.slug,
    (landing) => buildMarketingLandingPath(landing.slug),
    (landing) => landing.title || landing.slug || 'landing-sem-slug',
    'landings',
    now,
  );

  return {
    entries: [
      ...institutionalEntries,
      ...questionResult.indexedEntries,
      ...rankingResult.indexedEntries,
      ...materialResult.indexedEntries,
      ...landingResult.indexedEntries,
    ],
    coverage: {
      institutional: createCoverageBucket(SEO_PUBLIC_ROUTES.length, institutionalEntries.length),
      questions: createCoverageBucket(questionResult.total, questionResult.indexedEntries.length),
      rankings: createCoverageBucket(rankingResult.total, rankingResult.indexedEntries.length),
      materials: createCoverageBucket(materialResult.total, materialResult.indexedEntries.length),
      landings: createCoverageBucket(landingResult.total, landingResult.indexedEntries.length),
    },
    missingSamples: {
      questions: questionResult.missingLabels.slice(0, 10),
      rankings: rankingResult.missingLabels.slice(0, 10),
      materials: materialResult.missingLabels.slice(0, 10),
      landings: landingResult.missingLabels.slice(0, 10),
    },
  };
};

export const buildSeoSitemapStatus = async (): Promise<SeoSitemapStatusPayload> => {
  const siteUrl = getConfiguredSiteUrl();
  const result = await buildSeoSitemapEntries();

  return {
    scope: 'sitemap_coverage',
    generatedAt: new Date().toISOString(),
    canonicalBaseUrl: siteUrl.toString(),
    sitemapUrl: buildSiteUrl('/sitemap.xml', siteUrl),
    robotsUrl: buildSiteUrl('/robots.txt', siteUrl),
    totalUrls: result.entries.length,
    coverage: result.coverage,
    missingSamples: result.missingSamples,
    note: 'Cobertura mede URLs geradas no sitemap. Indexacao em buscadores depende de rastreamento externo.',
  };
};
