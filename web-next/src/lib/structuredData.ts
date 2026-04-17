import type { Material, Question, Ranking } from '@/types';
import {
  buildAbsoluteUrl,
  buildMaterialPath,
  buildQuestionPath,
  buildRankingPath,
  getQuestionSeoLabel,
  summarizeSeoText,
} from '@/services/seo/slug';

const ORGANIZATION = {
  '@type': 'Organization',
  name: 'ConcursoMestre',
  url: buildAbsoluteUrl('/'),
};

export const serializeStructuredData = (data: unknown) =>
  JSON.stringify(data).replace(/</g, '\\u003c');

const buildBreadcrumbList = (items: Array<{ name: string; path: string }>) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: buildAbsoluteUrl(item.path),
  })),
});

export const buildQuestionStructuredData = (question: Question) => {
  const canonicalPath = buildQuestionPath(question);
  const seoLabel = getQuestionSeoLabel(question);
  const subjectNames = question.assuntos?.map((item) => item.nome).filter(Boolean) || [];
  const organizationNames = question.orgaos?.map((item) => item.sigla || item.nome).filter(Boolean) || [];
  const boardNames = question.bancas?.map((item) => item.sigla || item.nome).filter(Boolean) || [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${buildAbsoluteUrl(canonicalPath)}#article`,
        mainEntityOfPage: buildAbsoluteUrl(canonicalPath),
        headline: summarizeSeoText(seoLabel, 110),
        description: summarizeSeoText(seoLabel, 180),
        inLanguage: 'pt-BR',
        publisher: ORGANIZATION,
        author: ORGANIZATION,
        about: [...subjectNames, ...organizationNames, ...boardNames].map((name) => ({
          '@type': 'Thing',
          name,
        })),
      },
      buildBreadcrumbList([
        { name: 'Inicio', path: '/' },
        { name: 'Questoes', path: '/practice' },
        { name: `Questao ${question.id}`, path: canonicalPath },
      ]),
    ],
  };
};

export const buildRankingStructuredData = (ranking: Ranking) => {
  const canonicalPath = buildRankingPath(ranking);
  const topEntries = Array.isArray(ranking.entries) ? ranking.entries.slice(0, 20) : [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${buildAbsoluteUrl(canonicalPath)}#webpage`,
        url: buildAbsoluteUrl(canonicalPath),
        name: `${ranking.name} | ${ranking.institution}`,
        description: summarizeSeoText(`Ranking ${ranking.name} da instituicao ${ranking.institution}.`, 180),
        inLanguage: 'pt-BR',
        publisher: ORGANIZATION,
      },
      {
        '@type': 'ItemList',
        '@id': `${buildAbsoluteUrl(canonicalPath)}#ranking`,
        name: ranking.name,
        numberOfItems: topEntries.length,
        itemListElement: topEntries.map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entry.userName,
          description: `${entry.category} - ${entry.examType || 'Padrao'} - ${entry.score} pontos`,
        })),
      },
      buildBreadcrumbList([
        { name: 'Inicio', path: '/' },
        { name: 'Rankings', path: '/ranking' },
        { name: ranking.name, path: canonicalPath },
      ]),
    ],
  };
};

const resolveMaterialSubject = (material: Material) => {
  if (typeof material.subject === 'string') {
    return material.subject;
  }

  return material.subjectText || material.topic || 'Concursos';
};

export const buildMaterialStructuredData = (material: Material) => {
  const canonicalPath = buildMaterialPath(material);
  const description = material.description || material.details || 'Material do marketplace ConcursoMestre.';
  const ratingValue = Number(material.rating || 0);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${buildAbsoluteUrl(canonicalPath)}#product`,
        name: material.title,
        description: summarizeSeoText(description, 180),
        image: material.coverUrl ? [material.coverUrl] : undefined,
        category: resolveMaterialSubject(material),
        brand: ORGANIZATION,
        offers: {
          '@type': 'Offer',
          url: buildAbsoluteUrl(canonicalPath),
          priceCurrency: 'BRL',
          price: Number(material.price || 0).toFixed(2),
          availability: material.status === 'approved' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
        aggregateRating: ratingValue > 0
          ? {
            '@type': 'AggregateRating',
            ratingValue,
            ratingCount: Math.max(Number(material.salesCount || 0), 1),
          }
          : undefined,
      },
      buildBreadcrumbList([
        { name: 'Inicio', path: '/' },
        { name: 'Marketplace', path: '/marketplace' },
        { name: material.title, path: canonicalPath },
      ]),
    ],
  };
};
