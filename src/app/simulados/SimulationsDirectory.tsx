import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock3, FileQuestion, Search } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { buildBreadcrumbList, buildCollectionPage, buildItemList, buildStructuredDataGraph } from '@services/seo/structuredData';
import { publicRoutes } from '@services/routes/publicRoutes';
import { fetchPublicSimulationDirectory } from './simulationServerData';

export default async function SimulationsDirectory({ searchParams }: { searchParams: Promise<{ pagina?: string; busca?: string }> }) {
  const params = await searchParams; const directory = await fetchPublicSimulationDirectory(params);
  const search = String(params.busca || '').trim(); const path = publicRoutes.simulations.index();
  const href = (page = 1) => { const query = new URLSearchParams(); if (search) query.set('busca', search); if (page > 1) query.set('pagina', String(page)); return query.size ? `${path}?${query}` : path; };
  const requestedPage = String(params.pagina || '').trim();
  if (requestedPage && (!/^[1-9]\d*$/.test(requestedPage) || Number(requestedPage) !== directory.pageInfo.page)) permanentRedirect(href(directory.pageInfo.page));
  const description = 'Encontre simulados editoriais públicos com composição estável e informações factuais para orientar sua prática.';
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Simulados', path }];
  const structuredData = buildStructuredDataGraph([
    buildCollectionPage({ path, name: 'Simulados', description }),
    buildBreadcrumbList(breadcrumbs),
    buildItemList(directory.items.map((item) => ({ name: item.title, path: item.path }))),
  ]);
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <StructuredData value={structuredData} />
    <CanonicalBreadcrumbs items={breadcrumbs} />
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><p className="text-[10px] font-black uppercase text-indigo-700">Prática editorial</p><h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>Simulados</h1><p className={`mt-3 max-w-3xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p></header>
    <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`} aria-label="Filtros de simulados"><form action={path} className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Buscar simulados</span><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input name="busca" defaultValue={search} className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Buscar simulados" /></label><button className="h-10 rounded-md bg-[#615fff] px-4 text-sm font-black text-white">Buscar</button></form></section>
    <section aria-labelledby="simulation-list"><div><h2 id="simulation-list" className="text-lg font-black">Simulados disponíveis</h2><p className="text-xs text-slate-500">{directory.pageInfo.total.toLocaleString('pt-BR')} registro(s) editorial(is) pronto(s)</p></div>{directory.items.length?<div className="mt-4 grid gap-3 md:grid-cols-2">{directory.items.map((item)=><Link key={item.id} href={item.path} className={`${PLATFORM_SURFACE_CARD_CLASS} p-4 hover:text-[#615fff]`}><span className="block font-black">{item.title}</span>{item.description?<span className="mt-1 line-clamp-2 block text-xs text-slate-500">{item.description}</span>:null}<span className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><FileQuestion size={13}/>{item.questionCount} questões</span>{item.durationMinutes?<span className="inline-flex items-center gap-1"><Clock3 size={13}/>{item.durationMinutes} min</span>:null}</span></Link>)}</div>:<div className={`${PLATFORM_SURFACE_CARD_CLASS} mt-4 p-8 text-center`}><p className="font-black">Nenhum simulado editorial público está disponível.</p><p className="mt-2 text-sm text-slate-500">A ferramenta de prática continua disponível na área autenticada.</p></div>}{directory.pageInfo.pages>1?<nav aria-label="Paginação" className="mt-5 flex justify-between text-sm font-bold">{directory.pageInfo.page>1?<Link href={href(directory.pageInfo.page-1)}><ChevronLeft size={15} className="inline"/> Anterior</Link>:<span/>}<span>Página {directory.pageInfo.page} de {directory.pageInfo.pages}</span>{directory.pageInfo.page<directory.pageInfo.pages?<Link href={href(directory.pageInfo.page+1)}>Próxima <ChevronRight size={15} className="inline"/></Link>:<span/>}</nav>:null}</section>
  </article>;
}
