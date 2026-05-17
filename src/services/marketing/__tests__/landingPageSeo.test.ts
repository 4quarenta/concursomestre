import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import { buildMarketingLandingMetadata } from '../landingPageSeo';
import { createDefaultPlansLandingPage } from '../landingPages';

type RobotsObject = {
  index?: boolean;
  googleBot?: {
    index?: boolean;
  };
};

const readRobotsObject = (robots: Metadata['robots']) => robots as RobotsObject;

const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: {
    'content-type': 'application/json',
  },
});

describe('landing page SEO metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds server metadata for published custom landings', async () => {
    vi.stubEnv('NEXT_PUBLIC_CANONICAL_URL', 'https://concursomestre.com.br');

    const landing = {
      ...createDefaultPlansLandingPage('ConcursoMestre'),
      id: 'landing-campanha',
      title: 'Campanha Especial',
      slug: 'campanha-especial',
      status: 'published' as const,
      seo: {
        title: 'Campanha Especial SEO',
        metaDescription: 'Descricao da campanha especial.',
        canonicalUrl: '/oferta/campanha-especial',
        ogTitle: 'Oferta ConcursoMestre',
        ogDescription: 'Oferta ativa para estudantes.',
      },
    };

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: {
        siteName: 'ConcursoMestre',
        landingPages: [landing],
      },
    })));

    const metadata = await buildMarketingLandingMetadata('campanha-especial');

    expect(metadata.title).toBe('Campanha Especial SEO');
    expect(metadata.description).toBe('Descricao da campanha especial.');
    expect(metadata.alternates?.canonical).toBe('https://concursomestre.com.br/oferta/campanha-especial');
    expect(readRobotsObject(metadata.robots).index).toBe(true);
    expect(metadata.openGraph?.title).toBe('Oferta ConcursoMestre');
  });

  it('marks draft custom landings as noindex', async () => {
    const landing = {
      ...createDefaultPlansLandingPage('ConcursoMestre'),
      id: 'landing-rascunho',
      title: 'Rascunho',
      slug: 'rascunho',
      status: 'draft' as const,
    };

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: {
        siteName: 'ConcursoMestre',
        landingPages: [landing],
      },
    })));

    const metadata = await buildMarketingLandingMetadata('rascunho');

    expect(String(metadata.title)).toContain('Campanha indisponivel');
    const robots = readRobotsObject(metadata.robots);
    expect(robots.index).toBe(false);
    expect(robots.googleBot?.index).toBe(false);
  });

  it('falls back to the default published landings when settings are unavailable', async () => {
    vi.stubEnv('NEXT_PUBLIC_CANONICAL_URL', 'https://concursomestre.com.br');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('settings unavailable');
    }));

    const metadata = await buildMarketingLandingMetadata('elite');

    expect(String(metadata.title)).toContain('Plano Elite');
    expect(metadata.alternates?.canonical).toBe('https://concursomestre.com.br/elite');
    expect(readRobotsObject(metadata.robots).index).toBe(true);
  });
});
