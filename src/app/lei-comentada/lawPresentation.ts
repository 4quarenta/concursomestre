import type { Metadata } from 'next';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import { fetchLawDetailForServer } from './legalCommentaryServerData';
import type { PublicLawArticleDetail } from './lawArticleServerData';

const tracking = (key: string) => key === 'gclid' || key === 'fbclid' || key.startsWith('utm_');

export const lawArticleName = (item: PublicLawArticleDetail) => item.law.shortTitle || item.law.title;
export const lawArticleHeading = (item: PublicLawArticleDetail) => `Art. ${item.article.number} da ${lawArticleName(item)}`;
export const lawArticleDescription = (item: PublicLawArticleDetail) => {
  const excerpt = item.article.officialText.replace(/\s+/g, ' ').trim();
  return (excerpt || `Consulte o texto oficial do art. ${item.article.number} da ${lawArticleName(item)}.`).slice(0, 160);
};

export const buildLawArticleMetadata = (
  item: PublicLawArticleDetail | null,
  searchParams: Record<string, string | string[] | undefined> = {},
): Metadata => {
  if (!item) return buildNoIndexMetadata({ title: 'Artigo normativo não encontrado' });
  const title = lawArticleHeading(item);
  const summary = lawArticleDescription(item);
  const metadata = buildPublicPageMetadata({ title, description: summary, path: item.canonicalPath });
  const functionalParams = Object.keys(searchParams).some((key) => !tracking(key));
  if (item.readiness.status === 'READY' && !functionalParams) return metadata;
  return { ...metadata, robots: { index: false, follow: true, googleBot: { index: false, follow: true } } };
};

export const descriptionForLaw = (law: Awaited<ReturnType<typeof fetchLawDetailForServer>>): string => {
  if (!law) return '';
  const description = String(law.summary || law.ementa || law.description || law.preamble || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (description || `Estude ${law.title} com texto legal atualizado e comentários para concursos públicos.`).slice(0, 160);
};

export const buildLawJsonLd = (
  law: NonNullable<Awaited<ReturnType<typeof fetchLawDetailForServer>>>,
) => {
  const path = publicRoutes.laws.detail(law.slug);
  const breadcrumbs = [
    { label: 'Início', path: '/' },
    { label: 'Lei Comentada', path: publicRoutes.laws.index() },
    { label: law.shortTitle || law.title, path },
  ];
  return buildStructuredDataGraph([
    buildWebPage({ path, name: law.title, description: descriptionForLaw(law) }),
    buildBreadcrumbList(breadcrumbs),
  ]);
};
