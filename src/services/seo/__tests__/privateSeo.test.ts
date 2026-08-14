import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isMarketingLandingEligibleForPublicSitemap,
  isMaterialEligibleForPublicSitemap,
  isQuestionEligibleForPublicSitemap,
  isRankingEligibleForPublicSitemap,
  SEO_PUBLIC_ROUTES,
  SEO_ROBOT_DISALLOW_PATHS,
} from '../sitemapData';
import type { MarketingLandingPage, Material, Question, Ranking } from 'types';

const makeQuestion = (patch: Partial<Question> & Record<string, unknown> = {}) => ({
  id: 1,
  enunciado: 'Questao publica',
  bancas: [],
  orgaos: [],
  cargos: [],
  assuntos: [],
  anos: [],
  tipo: 'multipla escolha',
  dificuldade: 1,
  itens: [],
  resposta: 1,
  ...patch,
} as Question);

const makeMaterial = (patch: Partial<Material> & Record<string, unknown> = {}) => ({
  id: 'm-1',
  title: 'Material',
  description: 'Descricao',
  authorId: 'u-1',
  authorName: 'Autor',
  price: 10,
  type: 'PDF',
  subject: 'Direito',
  status: 'approved',
  salesCount: 0,
  rating: 0,
  createdAt: 0,
  comments: [],
  ...patch,
} as Material);

const makeRanking = (patch: Partial<Ranking> & Record<string, unknown> = {}) => ({
  id: 'r-1',
  name: 'Ranking',
  institution: 'Instituicao',
  totalQuestions: 10,
  vacanciesAc: 1,
  vacanciesAfro: 0,
  vacanciesPcd: 0,
  reserveLimit: 0,
  correctKey: 'ABCDE',
  keyStatus: 'official',
  status: 'approved',
  examTypes: [],
  hasDiscursive: false,
  entries: [],
  createdAt: 0,
  ...patch,
} as Ranking);

const makeLanding = (patch: Partial<MarketingLandingPage> & Record<string, unknown> = {}) => ({
  id: 'landing-1',
  title: 'Campanha Publica',
  slug: 'campanha-publica',
  status: 'published',
  pageType: 'plans',
  linkedPlanId: null,
  hero: {
    eyebrow: '',
    title: '',
    description: '',
    primaryCtaLabel: '',
    secondaryCtaLabel: '',
    proof: '',
  },
  planCards: [],
  authoritySection: {
    eyebrow: '',
    title: '',
    description: '',
    items: [],
  },
  valueMatrix: {
    eyebrow: '',
    title: '',
    whatYouDo: [],
    whatYouReceive: [],
    whatYouConquer: [],
  },
  eliteSection: {
    eyebrow: '',
    title: '',
    description: '',
    bullets: [],
    ctaLabel: '',
  },
  comparisonRows: [],
  objections: [],
  guarantee: {
    title: '',
    description: '',
  },
  faq: [],
  finalCta: {
    title: '',
    description: '',
    primaryCtaLabel: '',
    secondaryCtaLabel: '',
  },
  seo: {
    title: '',
    metaDescription: '',
    canonicalUrl: '',
    ogTitle: '',
    ogDescription: '',
  },
  createdAt: '',
  updatedAt: '',
  ...patch,
} as MarketingLandingPage);

describe('private SEO surfaces', () => {
  it('keeps authenticated and paid-tool routes out of robots crawling', () => {
    expect(SEO_ROBOT_DISALLOW_PATHS).toEqual(expect.arrayContaining([
      '/admin',
      '/auth',
      '/cronograma',
      '/dashboard',
      '/profile',
      '/simulation',
      '/x-ray',
    ]));
  });

  it('does not include private routes in public sitemap entries', () => {
    const publicPaths = SEO_PUBLIC_ROUTES.map((route) => route.path);

    expect(publicPaths).not.toContain('/cronograma');
    expect(publicPaths).not.toContain('/dashboard');
    expect(publicPaths).not.toContain('/profile');
    expect(publicPaths).not.toContain('/auth');
    expect(publicPaths).not.toContain('/admin');
    expect(publicPaths).toContain('/questoes');
    expect(publicPaths).toContain('/provas');
    expect(publicPaths).not.toContain('/practice');
    expect(publicPaths).not.toContain('/plans');
    expect(publicPaths).not.toContain('/questions');
    expect(publicPaths).not.toContain('/blog/provas');
    expect(publicPaths).not.toContain('/read');
    expect(publicPaths).not.toContain('/subscription');
    expect(publicPaths).not.toContain('/support');
  });

  it('keeps robots disallow list aligned with private sitemap exclusions', () => {
    const publicPaths = new Set(SEO_PUBLIC_ROUTES.map((route) => route.path));

    SEO_ROBOT_DISALLOW_PATHS.forEach((path) => {
      const exactPath = path.endsWith('/') ? path.slice(0, -1) : path;
      expect(publicPaths.has(path)).toBe(false);
      expect(publicPaths.has(exactPath)).toBe(false);
    });
  });

  it('marks the Elite study schedule page as noindex', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/cronograma/layout.tsx'), 'utf8');

    expect(layoutSource).toContain('buildNoIndexMetadata');
    expect(layoutSource).not.toContain('buildPublicPageMetadata');
    expect(layoutSource).not.toContain("canonical: '/cronograma'");
  });

  it('keeps draft, scheduled and non-public questions out of the public sitemap', () => {
    expect(isQuestionEligibleForPublicSitemap(makeQuestion({ publishStatus: 'published', visibilityStatus: 'public' }))).toBe(true);
    expect(isQuestionEligibleForPublicSitemap(makeQuestion({ publishStatus: 'draft' }))).toBe(false);
    expect(isQuestionEligibleForPublicSitemap(makeQuestion({ publishStatus: 'scheduled', scheduledAt: '2999-01-01T00:00' }))).toBe(false);
    expect(isQuestionEligibleForPublicSitemap(makeQuestion({ publishStatus: 'published', visibilityStatus: 'elite' }))).toBe(false);
    expect(isQuestionEligibleForPublicSitemap(makeQuestion({ publishStatus: 'published', visibilityStatus: 'internal' }))).toBe(false);
  });

  it('keeps pending moderation items out of dynamic public sitemap entries', () => {
    expect(isMaterialEligibleForPublicSitemap(makeMaterial({ status: 'approved' }))).toBe(true);
    expect(isMaterialEligibleForPublicSitemap(makeMaterial({ status: 'pending' }))).toBe(false);
    expect(isMaterialEligibleForPublicSitemap(makeMaterial({ status: 'rejected' }))).toBe(false);

    expect(isRankingEligibleForPublicSitemap(makeRanking({ status: 'approved' }))).toBe(true);
    expect(isRankingEligibleForPublicSitemap(makeRanking({ status: 'pending' }))).toBe(false);
    expect(isRankingEligibleForPublicSitemap(makeRanking({ status: 'rejected' }))).toBe(false);
  });

  it('adds only published custom landings to dynamic public sitemap entries', () => {
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: 'campanha-publica', status: 'published' }))).toBe(true);
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: 'campanha-publica', status: 'draft' }))).toBe(false);
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: 'planos', status: 'published' }))).toBe(false);
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: 'elite', status: 'published' }))).toBe(false);
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: '', status: 'published' }))).toBe(false);
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: '../admin', status: 'published' }))).toBe(false);
    expect(isMarketingLandingEligibleForPublicSitemap(makeLanding({ slug: '/api/settings.php', status: 'published' }))).toBe(false);
  });
});
