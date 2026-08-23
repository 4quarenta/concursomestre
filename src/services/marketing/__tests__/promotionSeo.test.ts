import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import type { Promotion } from 'types';
import { buildPromotionMetadata } from '../promotionSeo';

type RobotsObject = {
  index?: boolean;
  googleBot?: {
    index?: boolean;
  };
};

const readRobotsObject = (robots: Metadata['robots']) => robots as RobotsObject;

const makePromotion = (patch: Partial<Promotion> = {}) => ({
  isActive: true,
  name: 'Black Friday',
  slug: 'black-friday',
  discountPercentage: 30,
  bannerText: 'Oferta ativa',
  themeColor: '#0f172a',
  landingPageTitle: 'Oferta especial',
  landingPageHeadline: 'Oferta especial',
  landingPageSubheadline: 'Desconto por tempo limitado',
  featuresHighlight: [],
  ...patch,
} as Promotion);

const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: {
    'content-type': 'application/json',
  },
});

describe('promotion SEO metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('keeps even an active temporary promotion noindex', async () => {
    vi.stubEnv('NEXT_PUBLIC_CANONICAL_URL', 'https://concursomestre.com.br');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: {
        siteName: 'ConcursoMestre',
        features: {
          landingPagePromoEnabled: true,
        },
        activePromotion: makePromotion({
          slug: 'black-friday',
          landingPageTitle: 'Oferta Black Friday',
          landingPageSubheadline: 'Plano Elite com desconto especial.',
        }),
      },
    })));

    const metadata = await buildPromotionMetadata('black-friday');

    expect(metadata.title).toBe('Oferta Black Friday');
    expect(metadata.description).toBe('Plano Elite com desconto especial.');
    expect(metadata.alternates?.canonical).toBe('https://concursomestre.com/promo/black-friday');
    expect(readRobotsObject(metadata.robots).index).toBe(false);
  });

  it('marks wrong or inactive promotion slugs as noindex', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: {
        siteName: 'ConcursoMestre',
        features: {
          landingPagePromoEnabled: true,
        },
        activePromotion: makePromotion({ slug: 'black-friday' }),
      },
    })));

    const metadata = await buildPromotionMetadata('campanha-antiga');

    expect(String(metadata.title)).toContain('Promocao indisponivel');
    const robots = readRobotsObject(metadata.robots);
    expect(robots.index).toBe(false);
    expect(robots.googleBot?.index).toBe(false);
  });

  it('marks the promotion as noindex when the promo feature is disabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: {
        features: {
          landingPagePromoEnabled: false,
        },
        activePromotion: makePromotion({ slug: 'black-friday' }),
      },
    })));

    const metadata = await buildPromotionMetadata('black-friday');

    expect(readRobotsObject(metadata.robots).index).toBe(false);
  });
});
