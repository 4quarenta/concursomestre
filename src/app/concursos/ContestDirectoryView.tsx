import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Landmark, Search } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { buildBreadcrumbList, buildCollectionPage, buildItemList, buildStructuredDataGraph } from '@services/seo/structuredData';
import { publicRoutes } from '@services/routes/publicRoutes';
import type { ContestDirectory } from './contestServerData';
import { contestStatusLabel } from './contestMetadata';

type Props = { directory: ContestDirectory; openOnly?: boolean; search?: string; year?: string; status?: string };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : null;

export default function ContestDirectoryView({ directory, openOnly = false, search = '', year = '', status = '' }: Props) {
  const path = openOnly ? publicRoutes.contests.open() : publicRoutes.contests.index();
  const title = openOnly ? 'Concursos abertos' : 'Concursos públicos';
  const breadcrumbs = openOnly
    ? [{ label: 'Início', path: '/' }, { label: 'Concursos', path: publicRoutes.contests.index() }, { label: title, path }]
    : [{ label: 'Início', path: '/' }, { label: title, path }];
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set('busca', search);
    if (year) params.set('ano', year);
    if (!openOnly && status) params.set('status', status);
    if (page > 1) params.set('pagina', String(page));
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };
  const itemList = buildItemList(directory.items.map((item) => ({ name: item.title, path: item.path })));
  const structuredData = buildStructuredDataGraph([
    buildCollectionPage({ path, name: title }),
    buildBreadcrumbList(breadcrumbs),
    itemList,
  ]);
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <StructuredData value={structuredData} />
    <CanonicalBreadcrumbs items={breadcrumbs} />
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
      <p className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300">Catálogo canônico</p>
      <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{title}</h1>
      <p className={`mt-3 max-w-3xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{openOnly ? 'Concursos com período de inscrição comprovadamente aberto por status e datas públicas.' : 'Acompanhe concursos reais, editais, cargos, provas e questões vinculados por relações explícitas.'}</p>
      {!openOnly ? <Link href={publicRoutes.contests.open()} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#615fff]">Ver concursos abertos <ChevronRight size={15} /></Link> : null}
    </header>
    <form action={path} method="get" className={`${PLATFORM_SURFACE_CARD_CLASS} grid gap-3 p-4 sm:grid-cols-[1fr_130px_190px_auto]`}>
      <label className="relative"><span className="sr-only">Buscar concursos</span><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input name="busca" defaultValue={search} placeholder="Buscar concurso" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
      <label><span className="sr-only">Ano</span><input name="ano" inputMode="numeric" defaultValue={year} placeholder="Ano" className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
      {!openOnly ? <label><span className="sr-only">Situação</span><select name="status" defaultValue={status} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Todas as situações</option><option value="registration_open">Inscrições abertas</option><option value="notice_published">Edital publicado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label> : <span />}
      <button type="submit" className="h-10 rounded-md bg-[#615fff] px-4 text-sm font-black text-white">Filtrar</button>
    </form>
    <section aria-labelledby="contest-list-title">
      <div className="flex items-end justify-between gap-3"><div><h2 id="contest-list-title" className="text-lg font-black text-slate-950 dark:text-white">{openOnly ? 'Inscrições abertas' : 'Concursos catalogados'}</h2><p className="mt-1 text-xs text-slate-500">{directory.pageInfo.total.toLocaleString('pt-BR')} registro(s) publicado(s)</p></div></div>
      {directory.items.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{directory.items.map((contest) => <article key={contest.id} className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-indigo-50 text-[#615fff] dark:bg-indigo-500/10"><ClipboardList size={18} /></span><div className="min-w-0"><p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{contestStatusLabel(contest.status)}</p><h3 className="mt-1 text-base font-black text-slate-950 dark:text-white"><Link href={contest.path} className="hover:text-[#615fff]">{contest.title}</Link></h3><p className="mt-2 text-xs text-slate-500">{[contest.organizationAcronym || contest.organization, contest.year].filter(Boolean).join(' · ') || 'Dados públicos em atualização'}</p>{contest.boardAcronym || contest.board ? <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><Landmark size={13} /> {contest.boardAcronym || contest.board}</p> : null}{contest.registrationEnd ? <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><CalendarDays size={13} /> Inscrições até {dateLabel(contest.registrationEnd)}</p> : null}</div></div></article>)}</div> : <div className={`${PLATFORM_SURFACE_CARD_CLASS} mt-4 p-8 text-center`}><p className="font-black text-slate-900 dark:text-white">Nenhum concurso publicado corresponde aos filtros.</p><p className="mt-2 text-sm text-slate-500">O catálogo mostra apenas entidades canônicas e publicadas.</p></div>}
      {directory.pageInfo.pages > 1 ? <nav aria-label="Paginação de concursos" className="mt-5 flex items-center justify-between gap-3 text-sm font-bold"><span className="text-slate-500">Página {directory.pageInfo.page} de {directory.pageInfo.pages}</span><span className="flex items-center gap-2">{directory.pageInfo.page > 1 ? <Link href={pageHref(directory.pageInfo.page - 1)} rel="prev" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 hover:text-[#615fff] dark:border-slate-700"><ChevronLeft size={15} /> Anterior</Link> : null}{directory.pageInfo.page < directory.pageInfo.pages ? <Link href={pageHref(directory.pageInfo.page + 1)} rel="next" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 hover:text-[#615fff] dark:border-slate-700">Próxima <ChevronRight size={15} /></Link> : null}</span></nav> : null}
    </section>
  </article>;
}
