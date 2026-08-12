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

import type { SeoPageSettings, SeoSettings } from '@types';

export const SEO_ROBOTS_OPTIONS = [
  { value: 'index,follow', label: 'Indexar e seguir' },
  { value: 'noindex,follow', label: 'Nao indexar e seguir' },
  { value: 'noindex,nofollow', label: 'Nao indexar nem seguir' },
  { value: 'index,nofollow', label: 'Indexar sem seguir' },
] as const;

export const SEO_PAGE_ORDER = ['landing', 'plans', 'faq', 'changelog', 'privacy', 'terms'] as const;

export const SEO_PAGE_LABELS: Record<(typeof SEO_PAGE_ORDER)[number], string> = {
  landing: 'Landing',
  plans: 'Planos',
  faq: 'FAQ',
  changelog: 'Novidades',
  privacy: 'Privacidade',
  terms: 'Termos',
};

const EMPTY_PAGE_SETTINGS: SeoPageSettings = {
  title: '',
  meta_description: '',
  canonical_url: '',
  og_title: '',
  og_description: '',
  og_image: '',
  robots_override: '',
};

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  global: {
    site_title: 'ConcursoMestre',
    meta_description: 'Plataforma completa para estudo, questoes, simulados e acompanhamento de desempenho.',
    canonical_base_url: 'https://concursomestre.com.br',
    robots_default: 'index,follow',
    default_og_title: 'ConcursoMestre',
    default_og_description: 'Mais que um banco de questões. Uma plataforma completa para acelerar sua aprovação.',
    default_og_image: '',
    default_twitter_title: 'ConcursoMestre',
    default_twitter_description: 'Questões, simulados e estatísticas para acelerar sua aprovação.',
    default_twitter_image: '',
    google_site_verification: '',
    bing_site_verification: '',
    noindex_non_production: true,
    enable_sitemap: true,
    enable_robots_txt_control: true,
  },
  pages: {
    landing: { ...EMPTY_PAGE_SETTINGS },
    plans: { ...EMPTY_PAGE_SETTINGS },
    faq: { ...EMPTY_PAGE_SETTINGS },
    changelog: { ...EMPTY_PAGE_SETTINGS },
    privacy: { ...EMPTY_PAGE_SETTINGS },
    terms: { ...EMPTY_PAGE_SETTINGS },
  },
};

export const mergeSeoSettings = (value?: Partial<SeoSettings> | null): SeoSettings => {
  const mergedGlobal = {
    ...DEFAULT_SEO_SETTINGS.global,
    ...(value?.global || {}),
  };

  const mergedPages = SEO_PAGE_ORDER.reduce((acc, pageKey) => {
    acc[pageKey] = {
      ...EMPTY_PAGE_SETTINGS,
      ...(value?.pages?.[pageKey] || {}),
    };
    return acc;
  }, {} as SeoSettings['pages']);

  return {
    global: mergedGlobal,
    pages: mergedPages,
  };
};

const hasText = (value?: string | null): boolean => String(value || '').trim().length > 0;

export const calculateSeoCompletenessScore = (seo: SeoSettings): number => {
  const globalChecks = [
    hasText(seo.global.site_title),
    hasText(seo.global.meta_description),
    hasText(seo.global.canonical_base_url),
    hasText(seo.global.default_og_title),
    hasText(seo.global.default_og_description),
    hasText(seo.global.default_twitter_title),
    hasText(seo.global.default_twitter_description),
  ];

  const pageChecks = SEO_PAGE_ORDER.flatMap((pageKey) => {
    const page = seo.pages[pageKey];
    return [
      hasText(page.title),
      hasText(page.meta_description),
    ];
  });

  const allChecks = [...globalChecks, ...pageChecks];
  const completed = allChecks.filter(Boolean).length;

  return Math.round((completed / allChecks.length) * 100);
};

export const buildSeoSerpPreview = (seo: SeoSettings, pageKey: keyof SeoSettings['pages']) => {
  const page = seo.pages[pageKey];
  return {
    title: page.title || seo.global.site_title,
    description: page.meta_description || seo.global.meta_description,
    canonical: page.canonical_url || `${seo.global.canonical_base_url.replace(/\/+$/, '')}/${pageKey === 'landing' ? '' : pageKey}`,
  };
};

export const buildSeoOgPreview = (seo: SeoSettings, pageKey: keyof SeoSettings['pages']) => {
  const page = seo.pages[pageKey];
  return {
    title: page.og_title || page.title || seo.global.default_og_title || seo.global.site_title,
    description: page.og_description || page.meta_description || seo.global.default_og_description,
    image: page.og_image || seo.global.default_og_image,
  };
};
