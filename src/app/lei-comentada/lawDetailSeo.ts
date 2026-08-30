import { publicRoutes } from '@services/routes/publicRoutes';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import type { fetchLawDetailForServer } from './legalCommentaryServerData';

type LawDetail = Awaited<ReturnType<typeof fetchLawDetailForServer>>;

export const plainText = (value: unknown): string => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const descriptionForLaw = (law: LawDetail): string => {
  if (!law) return '';
  const description = plainText(law.summary || law.ementa || law.description || law.preamble);
  return (description || `Estude ${law.title} com texto legal atualizado e comentários para concursos públicos.`).slice(0, 160);
};

export const buildLawJsonLd = (law: NonNullable<LawDetail>) => {
  const description = descriptionForLaw(law);
  const path = publicRoutes.laws.detail(law.slug);
  const breadcrumbs = [
    { label: 'Início', path: '/' },
    { label: 'Lei Comentada', path: publicRoutes.laws.index() },
    { label: law.shortTitle || law.title, path },
  ];
  return buildStructuredDataGraph([
    buildWebPage({ path, name: law.title, description }),
    buildBreadcrumbList(breadcrumbs),
  ]);
};
