import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, MapPin } from 'lucide-react';
import type { PublicExamDirectoryItem, PublicExamDirectoryPage } from './blogServerData';
import { examDirectoryFacets, filterExamDirectory, groupExamDirectoryByYear, paginateExamDirectory, type ExamDirectoryFilters } from './examDirectory';
import { buildBoardPath } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';

interface BlogExamDirectoryProps {
  items: PublicExamDirectoryItem[];
  filters?: ExamDirectoryFilters;
  compact?: boolean;
  pageInfo?: PublicExamDirectoryPage['pageInfo'];
  serverFacets?: PublicExamDirectoryPage['facets'];
}

const fileLinkClass = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200';

export default function BlogExamDirectory({
  items,
  filters = { year: '', region: '', state: '' },
  compact = false,
  pageInfo,
  serverFacets,
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
      ...(filters.year ? { ano: filters.year } : {}),
      ...(filters.region ? { regiao: filters.region } : {}),
      ...(filters.state ? { estado: filters.state } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
  });

  if (items.length === 0) return null;

  return (
    <section className="border-y border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
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

        {compact ? (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Anos com provas">
            {facets.years.slice(0, 8).map((year) => (
              <Link key={year} href={publicRoutes.exams.index({ ano: year })} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200">
                {year}
              </Link>
            ))}
          </div>
        ) : (
          <form action={publicRoutes.exams.index()} method="get" className="mt-6 grid gap-4 border-b border-slate-200 pb-6 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] dark:border-slate-800">
            <label className="text-xs font-black uppercase text-slate-500">
              Ano
              <select name="ano" defaultValue={filters.year} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Todos</option>
                {facets.years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase text-slate-500">
              Região
              <select name="regiao" defaultValue={filters.region} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Todas</option>
                {facets.regions.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase text-slate-500">
              Estado
              <select name="estado" defaultValue={filters.state} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Todos</option>
                {facets.states.map((state) => <option key={state.code || 'unknown'} value={state.code}>{state.name}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-5 text-sm font-bold text-white hover:bg-indigo-700 dark:bg-white dark:text-slate-950">Filtrar</button>
              <Link href={publicRoutes.exams.index()} className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Limpar</Link>
            </div>
          </form>
        )}

        {groups.length > 0 ? (
          <div className="mt-7 space-y-8">
            {groups.map((group) => (
              <div key={group.year || 'unknown'}>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">{group.year || 'Ano não informado'}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.items.map((exam) => (
                    <article key={exam.id} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
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
            <div className="flex items-center gap-2">
              {pagination.currentPage > 1 ? (
                <Link href={pageHref(pagination.currentPage - 1)} className="inline-flex h-10 items-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200">
                  <ChevronLeft size={16} /> Anterior
                </Link>
              ) : null}
              <span className="inline-flex h-10 items-center px-3 text-sm font-black text-slate-700 dark:text-slate-200">
                Página {pagination.currentPage} de {pagination.totalPages}
              </span>
              {pagination.currentPage < pagination.totalPages ? (
                <Link href={pageHref(pagination.currentPage + 1)} className="inline-flex h-10 items-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200">
                  Próxima <ChevronRight size={16} />
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
