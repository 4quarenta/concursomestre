import type { MarketingLandingPage, Material, Question, Ranking } from '@types';
import { isQuestionPubliclyVisible } from '../questions/questionPublication';
import { buildMarketingLandingPath, normalizeLandingSlug } from '../marketing/landingPages';

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

/**
 * Declarative inventory used by robots/tests only. Production sitemap
 * materialization is exclusively owned by the PHP static generator.
 */
export const SEO_PUBLIC_ROUTES = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/planos', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/questoes', changeFrequency: 'daily', priority: 0.9 },
  { path: '/provas', changeFrequency: 'daily', priority: 0.85 },
  { path: '/disciplinas', changeFrequency: 'daily', priority: 0.85 },
  { path: '/bancas', changeFrequency: 'daily', priority: 0.85 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/lei-comentada', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/blog', changeFrequency: 'daily', priority: 0.75 },
  { path: '/elite', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/marketplace', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/novidades', changeFrequency: 'weekly', priority: 0.55 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.35 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.35 },
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
  '/profile',
  '/read/',
  '/reset-password',
  '/simulation',
  '/subscription/',
  '/setup',
  '/checkout/',
  '/x-ray',
  '/api/',
];

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
  return status === '' || ['approved', 'published', 'publicado', 'active', 'ativo'].includes(status);
};

export const isRankingEligibleForPublicSitemap = (ranking: Ranking) => {
  const status = normalizePublicationToken((ranking as { status?: unknown }).status);
  return status === '' || ['approved', 'published', 'publicado', 'active', 'ativo'].includes(status);
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
