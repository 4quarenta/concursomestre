import Link from 'next/link';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import BrandLogo from '@/components/shared/layout/BrandLogo';
import BlogAccountAction from '../blog/BlogAccountAction';
import { fetchChangelogForServer } from '../changelog/changelogServerData';
import { buildSiteUrl } from '@/config/siteUrl';
import { serializeStructuredData } from '@services/seo/structuredData';
import PublicSuggestionsBoard from './PublicSuggestionsBoard';
import { fetchPublicSuggestionsForServer } from './novidadesSuggestionServerData';
import { publicRoutes } from '@services/routes/publicRoutes';

export const revalidate = 300;

type NovidadesPageProps = {
  searchParams: Promise<{ page?: string }>;
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

export default async function NovidadesPage({ searchParams }: NovidadesPageProps) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(params.page || '1', 10) || 1);
  const [result, publicSuggestions] = await Promise.all([
    fetchChangelogForServer({ page: requestedPage }),
    fetchPublicSuggestionsForServer(),
  ]);
  const { page, totalPages } = result.pageInfo;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Novidades do ConcursoMestre',
    url: buildSiteUrl('/novidades'),
    inLanguage: 'pt-BR',
    hasPart: result.items.map((entry) => ({
      '@type': 'Article',
      headline: entry.title,
      datePublished: entry.publishedAt || entry.releaseDate,
      description: entry.description,
    })),
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" aria-label="Ir para o início" className="inline-flex items-center">
            <BrandLogo width={180} priority variant="adaptive" alt="ConcursoMestre" />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-bold" aria-label="Navegação principal">
            <Link href={publicRoutes.questions.index()} className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 sm:inline-flex">Questões</Link>
            <Link href="/blog" className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 sm:inline-flex">Blog</Link>
            <BlogAccountAction />
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
              <Sparkles size={16} /> Evolução da plataforma
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-normal text-slate-950 dark:text-white">Novidades</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Veja, de forma simples, o que mudou e como cada melhoria pode ajudar nos seus estudos.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
          <div className="space-y-5">
            {result.items.map((entry, index) => (
              <article key={entry.id} id={entry.slug} className="grid gap-4 border-b border-slate-200 bg-white px-5 py-7 first:border-t dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[170px_minmax(0,1fr)] sm:px-6">
                <div>
                  <time dateTime={entry.releaseDate} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <CalendarDays size={15} /> {formatDate(entry.releaseDate)}
                  </time>
                  {index === 0 && page === 1 ? (
                    <span className="mt-3 inline-flex rounded-sm bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Mais recente</span>
                  ) : null}
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">{entry.title}</h2>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{entry.description}</p>
                  <div className="mt-6 space-y-5">
                    {entry.content.map((section) => (
                      <section key={`${entry.id}-${section.title}`}>
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{section.title}</h3>
                        <ul className="mt-2 space-y-2">
                          {section.items.map((item) => (
                            <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              <Check size={16} className="mt-1 shrink-0 text-emerald-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="mt-8 flex items-center justify-between" aria-label="Paginação das novidades">
              {page > 1 ? (
                <Link href={{ pathname: '/novidades', query: { page: page - 1 } }} className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <ChevronLeft size={16} /> Anteriores
                </Link>
              ) : <span />}
              <span className="text-xs font-bold text-slate-500">Página {page} de {totalPages}</span>
              {page < totalPages ? (
                <Link href={{ pathname: '/novidades', query: { page: page + 1 } }} className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Próximas <ChevronRight size={16} />
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </section>
        <PublicSuggestionsBoard initialSuggestions={publicSuggestions} />
      </main>
    </div>
  );
}
