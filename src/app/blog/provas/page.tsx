import type { Metadata } from 'next';
import BlogConversionCta from '../BlogConversionCta';
import BlogExamDirectory from '../BlogExamDirectory';
import BlogHeader from '../BlogHeader';
import { fetchPublicExamDirectoryPageForServer } from '../blogServerData';
import { buildSiteUrl } from '@/config/siteUrl';
import { serializeStructuredData } from '@services/seo/structuredData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Provas de concursos por ano, região e estado',
  description: 'Consulte provas de concursos, questões vinculadas e gabaritos organizados por ano, região e estado.',
  alternates: { canonical: '/blog/provas' },
};

type ExamDirectoryPageProps = {
  searchParams: Promise<{ ano?: string; regiao?: string; estado?: string; pagina?: string }>;
};

export default async function ExamDirectoryPage({ searchParams }: ExamDirectoryPageProps) {
  const params = await searchParams;
  const filters = {
    year: /^\d{4}$/.test(params.ano || '') ? String(params.ano) : '',
    region: String(params.regiao || '').slice(0, 40),
    state: /^[A-Z]{2}$/.test(params.estado || '') ? String(params.estado) : '',
    page: /^\d+$/.test(params.pagina || '') ? Math.max(1, Number(params.pagina)) : 1,
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
    url: buildSiteUrl('/blog/provas'),
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
