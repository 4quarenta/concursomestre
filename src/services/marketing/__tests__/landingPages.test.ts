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

import { describe, expect, it } from 'vitest';
import {
  buildMarketingLandingPath,
  mergeMarketingLandingPages,
  normalizeMarketingLandingPage,
} from '../landingPages';

describe('marketing landing pages', () => {
  it('creates the default published public landings when no payload exists', () => {
    const pages = mergeMarketingLandingPages(undefined, 'ConcursoMestre');

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.slug)).toEqual(['planos', 'elite']);
    expect(pages.every((page) => page.status === 'published')).toBe(true);
    expect(pages[1].planCards.map((card) => card.planName)).toEqual(['Gratuito', 'Elite']);
  });

  it('builds dedicated public paths for the default campaigns', () => {
    expect(buildMarketingLandingPath('planos')).toBe('/planos');
    expect(buildMarketingLandingPath('elite')).toBe('/elite');
    expect(buildMarketingLandingPath('campanha-especial')).toBe('/l/campanha-especial');
  });

  it('sanitizes marketing text and unsafe canonical urls from admin payloads', () => {
    const page = normalizeMarketingLandingPage({
      slug: 'campanha-segura',
      hero: {
        eyebrow: '<img src=x onerror="alert(1)">Oferta',
        title: '<script>alert(1)</script>Plano Elite',
        description: 'Estude <strong>com foco</strong>',
        primaryCtaLabel: 'Começar',
        secondaryCtaLabel: 'Planos',
        proof: 'Seguro',
      },
      seo: {
        title: '<b>Titulo</b>',
        metaDescription: '<img src=x onerror="alert(1)">Descricao',
        canonicalUrl: 'javascript:alert(1)',
        ogTitle: 'OG',
        ogDescription: '<script>alert(2)</script>Descricao OG',
      },
    }, 'ConcursoMestre');

    expect(page.hero.eyebrow).toBe('Oferta');
    expect(page.hero.title).toBe('Plano Elite');
    expect(page.hero.description).toBe('Estude com foco');
    expect(page.seo.title).toBe('Titulo');
    expect(page.seo.metaDescription).toBe('Descricao');
    expect(page.seo.ogDescription).toBe('Descricao OG');
    expect(page.seo.canonicalUrl).toBe('');
  });
});
