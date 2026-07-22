import type { Metadata } from 'next';
import { websiteManifest } from '@/config/platform';
import { buildSiteUrl } from '@/config/siteUrl';
import { buildNoIndexMetadata } from '../../seoMetadata';
import { fetchLawDetailForServer } from '../legalCommentaryServerData';
import LawDetailClient from './LawDetailClient';

export const revalidate = 300;

type LawDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const absoluteUrl = (path: string): string => buildSiteUrl(path);

const plainText = (value: unknown): string => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const descriptionForLaw = (law: Awaited<ReturnType<typeof fetchLawDetailForServer>>): string => {
  if (!law) return '';
  const description = plainText(law.summary || law.ementa || law.description || law.preamble);
  return (description || `Estude ${law.title} com texto legal atualizado e comentários para concursos públicos.`).slice(0, 160);
};

const serializeJsonLd = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

export async function generateMetadata({ params }: LawDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const law = await fetchLawDetailForServer(slug);

  if (!law) {
    return buildNoIndexMetadata({
      title: 'Lei não encontrada',
      description: 'Não foi possível localizar esta lei comentada.',
    });
  }

  const title = `${law.shortTitle || law.title} comentada`;
  const description = descriptionForLaw(law);
  const path = `/lei-comentada/${law.slug || slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: websiteManifest.product.name,
      locale: 'pt_BR',
      type: 'article',
      publishedTime: law.publishedAt || law.date || undefined,
      modifiedTime: law.lastUpdatedAt || law.lastSyncedAt || undefined,
    },
    twitter: { card: 'summary', title, description },
  };
}

const firstSearchValue = (value: string | string[] | undefined): string | undefined => (
  Array.isArray(value) ? value[0] : value
);

export default async function LawPage({ params, searchParams }: LawDetailPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const law = await fetchLawDetailForServer(slug);
  const canonicalSlug = law?.slug || slug;
  const description = descriptionForLaw(law);
  const jsonLd = law ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Article', 'LearningResource'],
        headline: law.title,
        alternativeHeadline: law.shortTitle || undefined,
        description,
        url: absoluteUrl(`/lei-comentada/${canonicalSlug}`),
        inLanguage: 'pt-BR',
        educationalUse: 'study',
        learningResourceType: 'legislação comentada',
        articleSection: law.area?.name || undefined,
        datePublished: law.publishedAt || law.date || undefined,
        dateModified: law.lastUpdatedAt || law.lastSyncedAt || undefined,
        isPartOf: {
          '@type': 'CollectionPage',
          name: 'Lei Comentada',
          url: absoluteUrl('/lei-comentada'),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Lei Comentada', item: absoluteUrl('/lei-comentada') },
          { '@type': 'ListItem', position: 3, name: law.shortTitle || law.title, item: absoluteUrl(`/lei-comentada/${canonicalSlug}`) },
        ],
      },
    ],
  } : null;

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      ) : null}
      <LawDetailClient
        initialLaw={law}
        initialSlug={slug}
        initialSearchParams={{
          from: firstSearchValue(resolvedSearchParams.from),
          to: firstSearchValue(resolvedSearchParams.to),
          sectionId: firstSearchValue(resolvedSearchParams.sectionId),
          section: firstSearchValue(resolvedSearchParams.section),
          lawId: firstSearchValue(resolvedSearchParams.lawId),
        }}
      />
    </>
  );
}
