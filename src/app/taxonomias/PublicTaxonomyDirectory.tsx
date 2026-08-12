import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, FileText, Landmark, ListChecks, Search } from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import { serializeStructuredData } from '@services/seo/structuredData';
import { buildBoardPath } from '@services/seo';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import PublicSubjectTaxonomyAccordion from './PublicSubjectTaxonomyAccordion';
import { fetchPublicTaxonomyDirectory, type PublicTaxonomyDirectoryKind } from './taxonomyDirectoryServerData';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type DirectoryConfig = {
  path: '/disciplinas' | '/bancas';
  title: string;
  singular: string;
  description: string;
  searchPlaceholder: string;
  practiceQueryKey: 'materia' | 'banca';
};

const CONFIG: Record<PublicTaxonomyDirectoryKind, DirectoryConfig> = {
  subjects: {
    path: '/disciplinas',
    title: 'Disciplinas',
    singular: 'disciplina',
    description: 'Explore as disciplinas com questões publicadas e direcione seus estudos por conteúdo.',
    searchPlaceholder: 'Buscar disciplina...',
    practiceQueryKey: 'materia',
  },
  boards: {
    path: '/bancas',
    title: 'Bancas',
    singular: 'banca',
    description: 'Conheça as bancas disponíveis e pratique com questões organizadas por perfil de cobrança.',
    searchPlaceholder: 'Buscar por nome ou sigla...',
    practiceQueryKey: 'banca',
  },
};

const buildDirectoryHref = (
  path: DirectoryConfig['path'],
  params: { page?: number; search?: string; letter?: string },
) => {
  const query = new URLSearchParams();
  if (params.search) query.set('busca', params.search);
  if (params.letter) query.set('letra', params.letter);
  if (params.page && params.page > 1) query.set('pagina', String(params.page));
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
};

export default async function PublicTaxonomyDirectory({
  type,
  searchParams,
}: {
  type: PublicTaxonomyDirectoryKind;
  searchParams: Promise<{ busca?: string; letra?: string; pagina?: string }>;
}) {
  const config = CONFIG[type];
  const params = await searchParams;
  const search = String(params.busca || '').trim().slice(0, 100);
  const letterCandidate = String(params.letra || '').trim().toUpperCase();
  const letter = /^[A-Z]$/.test(letterCandidate) ? letterCandidate : '';
  const requestedPage = Math.max(1, Number.parseInt(String(params.pagina || '1'), 10) || 1);
  const directory = await fetchPublicTaxonomyDirectory({ type, page: requestedPage, search, letter });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: config.title,
    description: config.description,
    url: buildSiteUrl(config.path),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: directory.items.length,
      itemListElement: directory.items.map((item, index) => ({
        '@type': 'ListItem',
        position: ((directory.pageInfo.page - 1) * directory.pageInfo.perPage) + index + 1,
        name: item.name,
        url: buildSiteUrl(type === 'boards'
          ? buildBoardPath(item)
          : `/practice?${config.practiceQueryKey}=${encodeURIComponent(item.name)}`),
      })),
    },
  };

  return (
    <div className="w-full animate-fade-in space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />

      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#615fff]">Biblioteca de questões</p>
          <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{config.title}</h1>
          <p className={`mt-2 ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{config.description}</p>
        </div>

        <nav className="flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:w-auto" aria-label="Diretórios de questões">
          <Link
            href="/disciplinas"
            prefetch={false}
            aria-current={type === 'subjects' ? 'page' : undefined}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-xs font-black transition-colors sm:flex-none ${type === 'subjects' ? 'bg-[#615fff] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <BookOpen size={15} /> Disciplinas
          </Link>
          <Link
            href="/bancas"
            prefetch={false}
            aria-current={type === 'boards' ? 'page' : undefined}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-xs font-black transition-colors sm:flex-none ${type === 'boards' ? 'bg-[#615fff] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <Landmark size={15} /> Bancas
          </Link>
        </nav>
      </header>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`} aria-label={`Filtros de ${config.title.toLowerCase()}`}>
        <form action={config.path} method="get" className="flex flex-col gap-3 sm:flex-row">
          {letter ? <input type="hidden" name="letra" value={letter} /> : null}
          <label className="relative flex-1">
            <span className="sr-only">{config.searchPlaceholder}</span>
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="busca"
              defaultValue={search}
              placeholder={config.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-[#615fff]/40 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <button type="submit" className="h-11 rounded-xl bg-[#615fff] px-6 text-xs font-black text-white transition-colors hover:bg-[#514dff]">Filtrar</button>
          {(search || letter) ? (
            <Link href={config.path} prefetch={false} className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-black text-slate-600 transition-colors hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Limpar</Link>
          ) : null}
        </form>

        <div className="mt-3 overflow-x-auto pb-1">
          <div className="flex min-w-max overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:w-full sm:min-w-0 dark:border-slate-800 dark:bg-slate-950">
            {LETTERS.map((value) => (
              <Link
                key={value}
                href={buildDirectoryHref(config.path, { search, letter: value })}
                prefetch={false}
                aria-current={letter === value ? 'page' : undefined}
                className={`flex h-9 w-11 items-center justify-center border-r border-slate-200 text-[11px] font-black transition-colors last:border-r-0 sm:w-auto sm:flex-1 dark:border-slate-800 ${letter === value ? 'bg-[#615fff] text-white' : 'text-slate-500 hover:bg-indigo-50 hover:text-[#615fff] dark:text-slate-300 dark:hover:bg-indigo-500/10'}`}
              >
                {value}
              </Link>
            ))}
            <Link
              href={buildDirectoryHref(config.path, { search })}
              prefetch={false}
              aria-current={!letter ? 'page' : undefined}
              className={`flex h-9 min-w-20 items-center justify-center px-4 text-[11px] font-black transition-colors ${!letter ? 'bg-[#615fff] text-white' : 'text-slate-500 hover:bg-indigo-50 hover:text-[#615fff] dark:text-slate-300 dark:hover:bg-indigo-500/10'}`}
            >
              Todos
            </Link>
          </div>
        </div>
      </section>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{config.title} disponíveis</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Selecione um item para estudar as questões relacionadas.</p>
          </div>
          <span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#615fff] dark:bg-indigo-500/10 dark:text-indigo-300">
            {directory.pageInfo.total.toLocaleString('pt-BR')} {directory.pageInfo.total === 1 ? config.singular : config.title.toLowerCase()}
          </span>
        </div>

        {directory.items.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {directory.items.map((item) => {
              const displayName = type === 'boards' && item.acronym && item.acronym !== item.name
                ? `${item.acronym} - ${item.name}`
                : item.name;
              if (type === 'subjects') {
                return <PublicSubjectTaxonomyAccordion key={item.id} item={item} />;
              }
              return (
                <Link
                  key={item.id}
                  href={buildBoardPath(item)}
                  prefetch={false}
                  className="group flex min-h-20 flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/40 sm:px-5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[#615fff] dark:bg-indigo-500/10 dark:text-indigo-300"><Landmark size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900 transition-colors group-hover:text-[#615fff] dark:text-slate-100">{displayName}</span>
                    {item.description ? <span className="mt-1 line-clamp-1 block text-xs text-slate-500 dark:text-slate-400">{item.description}</span> : null}
                  </span>
                  <span className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ListChecks size={13} className="text-[#615fff]" /> {item.questionCount.toLocaleString('pt-BR')} questões</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FileText size={13} className="text-[#615fff]" /> {item.examCount.toLocaleString('pt-BR')} provas</span>
                    <ChevronRight size={16} className="hidden text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#615fff] sm:block" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <Search size={32} className="mx-auto text-slate-300" />
            <p className="mt-4 font-bold text-slate-700 dark:text-slate-200">Nenhum resultado encontrado.</p>
            <p className="mt-1 text-sm text-slate-500">Tente outra letra ou ajuste a busca.</p>
          </div>
        )}

        {directory.pageInfo.pages > 1 ? (
          <nav className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5" aria-label="Paginação">
            {directory.pageInfo.hasPrevious ? (
              <Link href={buildDirectoryHref(config.path, { page: directory.pageInfo.page - 1, search, letter })} prefetch={false} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:bg-slate-900"><ChevronLeft size={14} /> Anterior</Link>
            ) : <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-300 dark:border-slate-800 dark:text-slate-700"><ChevronLeft size={14} /> Anterior</span>}
            <span className="text-xs font-bold text-slate-500">Página {directory.pageInfo.page} de {directory.pageInfo.pages}</span>
            {directory.pageInfo.hasMore ? (
              <Link href={buildDirectoryHref(config.path, { page: directory.pageInfo.page + 1, search, letter })} prefetch={false} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:bg-slate-900">Próxima <ChevronRight size={14} /></Link>
            ) : <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-300 dark:border-slate-800 dark:text-slate-700">Próxima <ChevronRight size={14} /></span>}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
