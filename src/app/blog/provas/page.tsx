import type { Metadata } from 'next';
import { applySeoLaunchModeToMetadata } from '@services/seo/launchControl';
import { permanentRedirect } from 'next/navigation';
import BlogConversionCta from '../BlogConversionCta';
import BlogExamDirectory from '../BlogExamDirectory';
import BlogHeader from '../BlogHeader';
import { fetchPublicExamDirectoryPageForServer } from '../blogServerData';
import { buildSiteUrl } from '@/config/siteUrl';
import { serializeStructuredData } from '@services/seo/structuredData';
import {
  classifyPublicRouteParameter,
  publicRoutes,
  sanitizePublicRouteQuery,
} from '@services/routes/publicRoutes';

export const revalidate = 300;

type ExamDirectoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = 'Provas de concursos por ano, região e estado';
const DESCRIPTION = 'Consulte provas de concursos, questões vinculadas e gabaritos organizados por ano, região e estado.';
const firstValue = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? String(value[0] || '') : String(value || '')
);

const resolveExamCollectionSeo = (query: Record<string, string | string[] | undefined>) => {
  const rawPage = firstValue(query.pagina);
  const requestedPage = /^\d+$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  const hasFacetOrUnknown = Object.keys(query).some((parameter) => {
    const classification = classifyPublicRouteParameter(parameter);
    return classification !== 'tracking'
      && classification !== 'internal'
      && classification !== 'pagination';
  });

  return {
    canonical: !hasFacetOrUnknown && requestedPage >= 2
      ? publicRoutes.exams.index({ pagina: requestedPage })
      : publicRoutes.exams.index(),
    hasFacetOrUnknown,
    rawPage,
    requestedPage,
  };
};

export async function generateMetadata({ searchParams }: ExamDirectoryPageProps): Promise<Metadata> {
  const query = await searchParams;
  const { canonical, hasFacetOrUnknown } = resolveExamCollectionSeo(query);

  return applySeoLaunchModeToMetadata({
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { title: TITLE, description: DESCRIPTION, url: canonical, type: 'website' },
    robots: hasFacetOrUnknown
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : { index: true, follow: true },
  }, undefined, '/provas');
}

export default async function ExamDirectoryPage({ searchParams }: ExamDirectoryPageProps) {
  const params = await searchParams;
  const collectionSeo = resolveExamCollectionSeo(params);
  if (collectionSeo.rawPage === '1') {
    const normalizedQuery = sanitizePublicRouteQuery('exam_hub', params);
    normalizedQuery.delete('pagina');
    permanentRedirect(publicRoutes.exams.index(normalizedQuery));
  }
  const filters = {
    year: /^\d{4}$/.test(firstValue(params.ano)) ? firstValue(params.ano) : '',
    region: firstValue(params.regiao).slice(0, 40),
    state: /^[A-Z]{2}$/.test(firstValue(params.estado)) ? firstValue(params.estado) : '',
    page: /^\d+$/.test(firstValue(params.pagina)) ? Math.max(1, Number(firstValue(params.pagina))) : 1,
  };
  const directory = await fetchPublicExamDirectoryPageForServer({
    page: filters.page,
    limit: 12,
    year: filters.year,
    region: filters.region,
    state: filters.state,
  });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Provas de concursos',
    url: buildSiteUrl(collectionSeo.canonical),
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: directory.items.map((exam, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: exam.title,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />
      <BlogHeader />
      <main>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Acervo ConcursoMestre</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white lg:text-4xl">Provas de concursos</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Consulte o acervo público por ano, região e estado, com acesso aos arquivos disponíveis e às questões já vinculadas.
            </p>
          </div>
        </section>
        <BlogExamDirectory
          items={directory.items}
          filters={filters}
          pageInfo={directory.pageInfo}
          serverFacets={directory.facets}
        />
        <BlogConversionCta />
      </main>
    </div>
  );
}
