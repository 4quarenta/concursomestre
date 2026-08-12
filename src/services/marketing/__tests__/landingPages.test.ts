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

  it('respects an explicit landing collection after an administrator removes pages', () => {
    expect(mergeMarketingLandingPages([], 'ConcursoMestre')).toEqual([]);

    const eliteOnly = mergeMarketingLandingPages([
      { ...mergeMarketingLandingPages(undefined, 'ConcursoMestre')[1] },
    ], 'ConcursoMestre');

    expect(eliteOnly).toHaveLength(1);
    expect(eliteOnly[0].slug).toBe('elite');
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

  it('keeps landing payloads plain-text and blocks sensitive canonical paths', () => {
    const page = normalizeMarketingLandingPage({
      slug: '<svg onload=alert(1)>campanha-especial',
      hero: {
        eyebrow: 'Oferta <iframe src="https://evil.test"></iframe>',
        title: 'Aprovação <svg><script>alert(1)</script></svg> com método',
        description: 'Clique <a href="javascript:alert(1)">aqui</a> para estudar',
      },
      planCards: [
        {
          id: 'card-xss',
          title: 'Elite <img src=x onerror=alert(1)>',
          planName: 'Elite',
          badge: '<script>alert(1)</script>Seguro',
          description: '<b>Plano</b> completo',
          ctaLabel: 'Assinar',
          summaryBenefits: ['Resolver questões', '<img src=x onerror=alert(1)>Sem script'],
        },
      ],
      faq: [
        {
          id: 'faq-xss',
          question: '<script>alert(1)</script>Tem contrato?',
          answer: 'Sim <img src=x onerror=alert(1)> sem HTML executável.',
        },
      ],
      seo: {
        canonicalUrl: '//evil.test/campanha',
      },
    }, 'ConcursoMestre');

    expect(page.slug).toBe('campanha-especial');
    expect(page.hero.eyebrow).toBe('Oferta');
    expect(page.hero.title).toBe('Aprovação com método');
    expect(page.hero.description).toBe('Clique aqui para estudar');
    expect(page.planCards[0].title).toBe('Elite');
    expect(page.planCards[0].badge).toBe('Seguro');
    expect(page.planCards[0].description).toBe('Plano completo');
    expect(page.planCards[0].summaryBenefits).toEqual(['Resolver questões', 'Sem script']);
    expect(page.faq[0].question).toBe('Tem contrato?');
    expect(page.faq[0].answer).toBe('Sim sem HTML executável.');
    expect(page.seo.canonicalUrl).toBe('');

    const adminCanonical = normalizeMarketingLandingPage({
      slug: 'admin-canonical',
      seo: { canonicalUrl: '/admin/panel/dashboard' },
    }, 'ConcursoMestre');
    const apiCanonical = normalizeMarketingLandingPage({
      slug: 'api-canonical',
      seo: { canonicalUrl: '/api/settings.php' },
    }, 'ConcursoMestre');
    const publicCanonical = normalizeMarketingLandingPage({
      slug: 'public-canonical',
      seo: { canonicalUrl: '/l/campanha-especial?utm=home' },
    }, 'ConcursoMestre');
    const httpsCanonical = normalizeMarketingLandingPage({
      slug: 'https-canonical',
      seo: { canonicalUrl: 'https://concursomestre.com.br/l/campanha-especial' },
    }, 'ConcursoMestre');

    expect(adminCanonical.seo.canonicalUrl).toBe('');
    expect(apiCanonical.seo.canonicalUrl).toBe('');
    expect(publicCanonical.seo.canonicalUrl).toBe('/l/campanha-especial?utm=home');
    expect(httpsCanonical.seo.canonicalUrl).toBe('https://concursomestre.com.br/l/campanha-especial');
  });
});
