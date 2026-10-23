import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, MapPin, MoreHorizontal, RotateCcw, Search } from 'lucide-react';
import type { PublicExamDirectoryItem, PublicExamDirectoryPage } from './blogServerData';
import { examDirectoryFacets, filterExamDirectory, getExamPaginationItems, groupExamDirectoryByYear, paginateExamDirectory, type ExamDirectoryFilters } from './examDirectory';
import { buildBoardPath } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import styles from '../practice/PracticeClient.module.css';

interface BlogExamDirectoryProps {
  items: PublicExamDirectoryItem[];
  filters?: ExamDirectoryFilters;
  compact?: boolean;
  pageInfo?: PublicExamDirectoryPage['pageInfo'];
  serverFacets?: PublicExamDirectoryPage['facets'];
  platformShell?: boolean;
}

const fileLinkClass = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200';

export default function BlogExamDirectory({
  items,
  filters = { year: '', region: '', state: '' },
  compact = false,
  pageInfo,
  serverFacets,
  platformShell = false,
}: BlogExamDirectoryProps) {
  const facets = serverFacets || examDirectoryFacets(items);
  const filtered = pageInfo ? items : filterExamDirectory(items, filters);
  const pagination = pageInfo ? {
    items,
    currentPage: pageInfo.page,
    totalPages: pageInfo.totalPages,
    totalItems: pageInfo.totalItems,
    start: pageInfo.totalItems === 0 ? 0 : ((pageInfo.page - 1) * pageInfo.limit) + 1,
    end: Math.min(pageInfo.totalItems, pageInfo.page * pageInfo.limit),
  } : paginateExamDirectory(filtered, filters.page || 1, compact ? 8 : 12);
  const visible = pagination.items;
  const groups = groupExamDirectoryByYear(visible);
  const pageHref = (page: number) => publicRoutes.exams.index({
      ...(filters.search ? { busca: filters.search } : {}),
      ...(filters.year ? { ano: filters.year } : {}),
      ...(filters.region ? { regiao: filters.region } : {}),
      ...(filters.state ? { estado: filters.state } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
  });

  if (items.length === 0 && compact) return null;

  return (
    <section className={platformShell
      ? `${styles.page} -mx-3 w-[calc(100%+1.5rem)] space-y-5 pb-16 sm:mx-0 sm:w-full md:pb-12`
      : 'border-y border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950'}>
      <div className={platformShell ? 'w-full space-y-5' : 'mx-auto max-w-7xl px-5 lg:px-8'}>
        {!platformShell ? (
          <div className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-end dark:border-slate-700">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600">Banco de provas</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Provas por ano e localidade</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Encontre provas publicadas, questões vinculadas e arquivos oficiais organizados por região e estado.
              </p>
            </div>
            {compact ? (
              <Link href={publicRoutes.exams.index()} className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">
                Ver todas <ArrowRight size={15} />
              </Link>
            ) : null}
          </div>
        ) : null}

        {compact ? (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Anos com provas">
            {facets.years.slice(0, 8).map((year) => (
              <Link key={year} href={publicRoutes.exams.index({ ano: year })} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200">
                {year}
              </Link>
            ))}
          </div>
        ) : (
          <form action={publicRoutes.exams.index()} method="get" className={platformShell
            ? `${styles.filterPanel} ${styles.filterToolbar} border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`
            : 'mt-6 grid gap-4 border-b border-slate-200 pb-6 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] dark:border-slate-800'}>
            <label className={platformShell ? `${styles.keywordSearch} relative flex flex-col gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300` : 'text-xs font-black uppercase text-slate-500'}>
              <span>Buscar provas</span>
              {platformShell ? <Search aria-hidden="true" size={17} className="absolute left-3 top-[31px] text-slate-400 dark:text-slate-500" /> : null}
              <input name="busca" defaultValue={filters.search || ''} placeholder="Concurso, cargo, banca ou órgão" className={platformShell
                ? 'w-full border border-slate-200 px-10 text-sm font-medium normal-case text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500'
                : 'mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case text-slate-800 placeholder:font-normal dark:border-slate-700 dark:bg-slate-900 dark:text-white'} />
            </label>
            <label className={platformShell ? `${styles.quickFilter} flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300` : 'text-xs font-black uppercase text-slate-500'}>
              Ano
              <select name="ano" defaultValue={filters.year} className={platformShell
                ? 'h-[42px] w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                : 'mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}>
                <option value="">Todos</option>
                {facets.years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className={platformShell ? `${styles.quickFilter} flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300` : 'text-xs font-black uppercase text-slate-500'}>
              Região
              <select name="regiao" defaultValue={filters.region} className={platformShell
                ? 'h-[42px] w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                : 'mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}>
                <option value="">Todas</option>
                {facets.regions.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </label>
            <label className={platformShell ? `${styles.quickFilter} flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300` : 'text-xs font-black uppercase text-slate-500'}>
              Estado
              <select name="estado" defaultValue={filters.state} className={platformShell
                ? 'h-[42px] w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                : 'mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}>
                <option value="">Todos</option>
                {facets.states.map((state) => <option key={state.code || 'unknown'} value={state.code}>{state.name}</option>)}
              </select>
            </label>
            <div className={platformShell ? 'grid grid-cols-[minmax(0,1fr)_40px] items-end gap-[7px]' : 'flex items-end gap-2'}>
              <button type="submit" className={platformShell
                ? `${styles.submitFilters} w-full`
                : 'inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-5 text-sm font-bold text-white hover:bg-indigo-700 dark:bg-white dark:text-slate-950'}>Filtrar</button>
              {platformShell ? (
                <Link href={publicRoutes.exams.index()} aria-label="Limpar filtros" title="Limpar filtros" className={styles.clearFilters}>
                  <RotateCcw size={18} />
                </Link>
              ) : (
                <Link href={publicRoutes.exams.index()} className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Limpar</Link>
              )}
            </div>
          </form>
        )}

        {platformShell ? (
          <div className={`${styles.resultToolbar} bg-white dark:bg-slate-900`}>
            <p className={styles.resultCount}>
              <strong>{new Intl.NumberFormat('pt-BR').format(pagination.totalItems)}</strong> provas encontradas
            </p>
          </div>
        ) : null}

        {groups.length > 0 ? (
          <div className={platformShell ? 'space-y-6' : 'mt-7 space-y-8'}>
            {groups.map((group) => (
              <div key={group.year || 'unknown'}>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">{group.year || 'Ano não informado'}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.items.map((exam) => (
                    <article key={exam.id} className="rounded-md border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={publicRoutes.exams.detail(exam.slug)} className="line-clamp-2 text-sm font-black leading-5 text-slate-950 hover:text-indigo-600 dark:text-white">
                            {exam.title}
                          </Link>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1"><MapPin size={13} /> {exam.region} · {exam.stateName}</span>
                            {exam.board ? (
                              <Link href={buildBoardPath({ slug: exam.boardSlug, name: exam.board })} prefetch={false} className="font-semibold hover:text-indigo-600 hover:underline">
                                {exam.board}
                              </Link>
                            ) : null}
                            <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> {exam.questionCount} questões</span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-slate-200 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{exam.year}</span>
                      </div>
                      {(exam.proofUrl || exam.answerKeyUrl) ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {exam.proofUrl ? <a href={exam.proofUrl} target="_blank" rel="noreferrer" className={fileLinkClass}><FileText size={14} /> Prova</a> : null}
                          {exam.answerKeyUrl ? <a href={exam.answerKeyUrl} target="_blank" rel="noreferrer" className={fileLinkClass}><Download size={14} /> Gabarito</a> : null}
                        </div>
                      ) : null}
                      <Link href={publicRoutes.exams.detail(exam.slug)} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-indigo-600 hover:underline">
                        Ver detalhes <ArrowRight size={14} />
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-md border border-dashed border-slate-300 px-5 py-12 text-center dark:border-slate-700">
            <p className="font-bold text-slate-700 dark:text-slate-200">Nenhuma prova corresponde aos filtros selecionados.</p>
          </div>
        )}

        {!compact && pagination.totalItems > 0 ? (
          <nav className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800" aria-label="Paginação do acervo de provas">
            <p className="text-sm text-slate-500">
              Mostrando {pagination.start}–{pagination.end} de {pagination.totalItems} provas
            </p>
            <div className="flex max-w-full items-center gap-1 overflow-x-auto">
              {pagination.currentPage > 1 ? (
                <Link href={pageHref(pagination.currentPage - 1)} rel="prev" aria-label="Página anterior" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200">
                  <ChevronLeft size={16} />
                </Link>
              ) : null}
              {getExamPaginationItems(pagination.currentPage, pagination.totalPages).map((item, index) => item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
                  <MoreHorizontal size={16} />
                </span>
              ) : (
                <Link
                  key={item}
                  href={pageHref(item)}
                  aria-label={`Página ${item}`}
                  aria-current={pagination.currentPage === item ? 'page' : undefined}
                  className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors ${pagination.currentPage === item
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-200'
                    : 'border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  {item}
                </Link>
              ))}
              {pagination.currentPage < pagination.totalPages ? (
                <Link href={pageHref(pagination.currentPage + 1)} rel="next" aria-label="Próxima página" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200">
                  <ChevronRight size={16} />
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
