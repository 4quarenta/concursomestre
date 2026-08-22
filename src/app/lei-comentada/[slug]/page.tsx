import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { websiteManifest } from '@/config/platform';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildNoIndexMetadata } from '../../seoMetadata';
import { publicRoutes } from '@services/routes/publicRoutes';
import ModuleAccessFallback from '@/components/shared/feedback/ModuleAccessFallback';
import {
  fetchLawDetailForServer,
  fetchLegalCommentaryModuleAvailability,
} from '../legalCommentaryServerData';
import LawDetailClient from './LawDetailClient';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const revalidate = 300;

type LawDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const plainText = (value: unknown): string => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const descriptionForLaw = (law: Awaited<ReturnType<typeof fetchLawDetailForServer>>): string => {
  if (!law) return '';
  const description = plainText(law.summary || law.ementa || law.description || law.preamble);
  return (description || `Estude ${law.title} com texto legal atualizado e coment\u00e1rios para concursos p\u00fablicos.`).slice(0, 160);
};

export const buildLawJsonLd = (
  law: NonNullable<Awaited<ReturnType<typeof fetchLawDetailForServer>>>,
) => {
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

export async function generateMetadata({ params }: LawDetailPageProps): Promise<Metadata> {
  const isModuleAvailable = await fetchLegalCommentaryModuleAvailability();
  if (!isModuleAvailable) {
    return buildNoIndexMetadata({
      title: 'Lei Comentada indisponível',
      description: 'O módulo de Lei Comentada não está disponível no momento.',
    });
  }

  const { slug } = await params;
  const law = await fetchLawDetailForServer(slug);

  if (!law) {
    notFound();
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

const LawPublicFallback = ({
  law,
}: {
  law: NonNullable<Awaited<ReturnType<typeof fetchLawDetailForServer>>>;
}) => (
  <section aria-labelledby="law-public-text-title" className="space-y-5" data-hydration-interaction>
    <h2 id="law-public-text-title" className="text-xl font-black text-slate-900 dark:text-slate-100">Texto legal público</h2>
    <div className="space-y-4">
      {law.articles.map((article) => (
        <section key={String(article.id)} className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-black text-slate-900 dark:text-slate-100">
            {article.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)
              && ['active', 'revoked', 'vetoed'].includes(article.officialStatus || 'active')
              && plainText(article.text) ? (
                <Link href={publicRoutes.laws.article(law.slug, article.slug)}>{article.title || `Art. ${article.number}`}</Link>
              ) : (article.title || `Art. ${article.number}`)}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300">{plainText(article.text)}</p>
        </section>
      ))}
    </div>
  </section>
);

export default async function LawPage({ params }: LawDetailPageProps) {
  const isModuleAvailable = await fetchLegalCommentaryModuleAvailability();
  if (!isModuleAvailable) {
    return (
      <div data-semantic-content>
        <ModuleAccessFallback
          tone="disabled"
          eyebrow="Módulo indisponível"
          title="Lei comentada indisponível"
          description="O módulo Lei comentada não está disponível no momento."
          ctaTo="/"
          ctaLabel="Voltar ao início"
        />
      </div>
    );
  }

  const { slug } = await params;
  const law = await fetchLawDetailForServer(slug);
  if (!law) {
    notFound();
  }
  const jsonLd = law ? buildLawJsonLd(law) : null;
  const publicTitle = law
    ? (law.number ? `Lei nº ${law.number}/${law.year || ''}` : (law.shortTitle || law.title))
    : '';
  const breadcrumbs = [
    { label: 'Início', path: '/' },
    { label: 'Lei Comentada', path: publicRoutes.laws.index() },
    { label: law.shortTitle || law.title, path: publicRoutes.laws.detail(law.slug) },
  ];

  return (
    <>
      {jsonLd ? (
        <StructuredData value={jsonLd} />
      ) : null}
      {law ? (
        <header className="space-y-4 pb-6" data-semantic-content>
          <CanonicalBreadcrumbs items={breadcrumbs} />
          <div>
            <p className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">Texto legal e navegação pública</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{publicTitle}</h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{descriptionForLaw(law)}</p>
          </div>
        </header>
      ) : null}
      <Suspense fallback={law ? <LawPublicFallback law={law} /> : null}>
        <LawDetailClient
          initialLaw={law}
          initialSlug={slug}
          semanticHeaderRendered={Boolean(law)}
        />
      </Suspense>
    </>
  );
}
