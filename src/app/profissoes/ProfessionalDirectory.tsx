import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Search, UsersRound } from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { serializeStructuredData } from '@services/seo/structuredData';
import { publicRoutes } from '@services/routes/publicRoutes';
import { fetchProfessionalDirectory, type ProfessionalKind } from './professionalServerData';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export default async function ProfessionalDirectory({ kind, searchParams }: { kind: ProfessionalKind; searchParams: Promise<{ pagina?: string; busca?: string; letra?: string }> }) {
  const params = await searchParams; const directory = await fetchProfessionalDirectory(kind, params);
  const career = kind === 'career'; const path = career ? '/carreiras' : '/cargos'; const title = career ? 'Carreiras' : 'Cargos';
  const description = career ? 'Explore agrupamentos profissionais editoriais e os cargos relacionados a cada carreira.' : 'Encontre cargos públicos e acesse concursos, provas e questões ligados por relações canônicas.';
  const search = String(params.busca || '').trim(); const letter = /^[A-Z]$/.test(String(params.letra || '').toUpperCase()) ? String(params.letra).toUpperCase() : '';
  const href = (page = 1, nextLetter = letter) => { const query = new URLSearchParams(); if (search) query.set('busca', search); if (nextLetter) query.set('letra', nextLetter); if (page > 1) query.set('pagina', String(page)); return query.size ? `${path}?${query}` : path; };
  const requestedPage = String(params.pagina || '').trim();
  if (requestedPage && (!/^[1-9]\d*$/.test(requestedPage) || Number(requestedPage) !== directory.pageInfo.page)) {
    permanentRedirect(href(directory.pageInfo.page));
  }
  const structuredData = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': `${buildSiteUrl(path)}#webpage`, url: buildSiteUrl(path), name: title, description },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: buildSiteUrl('/') }, { '@type': 'ListItem', position: 2, name: title, item: buildSiteUrl(path) }] },
    { '@type': 'ItemList', numberOfItems: directory.items.length, itemListElement: directory.items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: buildSiteUrl(item.path) })) },
  ] };
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Link href="/">Início</Link><ChevronRight size={12} /><span aria-current="page">{title}</span></nav>
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><p className="text-[10px] font-black uppercase text-indigo-700">Catálogo profissional</p><h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{title}</h1><p className={`mt-3 max-w-3xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p><div className="mt-4 flex gap-3 text-sm font-black"><Link href={publicRoutes.careers.index()} className={career ? 'text-[#615fff]' : ''}>Carreiras</Link><Link href={publicRoutes.positions.index()} className={!career ? 'text-[#615fff]' : ''}>Cargos</Link></div></header>
    <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`} aria-label={`Filtros de ${title.toLowerCase()}`}><form action={path} className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Buscar {title.toLowerCase()}</span><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input name="busca" defaultValue={search} className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder={`Buscar ${title.toLowerCase()}`} /></label><button className="h-10 rounded-md bg-[#615fff] px-4 text-sm font-black text-white">Filtrar</button></form><nav aria-label="Filtro alfabético" className="mt-3 flex gap-1 overflow-x-auto">{LETTERS.map((value) => <Link key={value} href={href(1,value)} className={`grid h-8 min-w-8 place-items-center rounded-md text-xs font-black ${letter===value?'bg-[#615fff] text-white':'bg-slate-100 dark:bg-slate-800'}`}>{value}</Link>)}</nav></section>
    <section aria-labelledby="professional-list"><div className="flex items-end justify-between"><div><h2 id="professional-list" className="text-lg font-black">{title} disponíveis</h2><p className="text-xs text-slate-500">{directory.pageInfo.total.toLocaleString('pt-BR')} registro(s) público(s)</p></div></div>{directory.items.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{directory.items.map((item) => <Link key={item.id} href={item.path} className={`${PLATFORM_SURFACE_CARD_CLASS} flex gap-3 p-4 hover:text-[#615fff]`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-indigo-50 text-[#615fff]">{career?<UsersRound size={18}/>:<BriefcaseBusiness size={18}/>}</span><span className="min-w-0"><span className="block font-black">{item.name}</span>{item.description?<span className="mt-1 line-clamp-2 block text-xs text-slate-500">{item.description}</span>:null}<span className="mt-2 block text-xs text-slate-500">{item.questionCount} questões · {item.examCount} provas</span></span></Link>)}</div>:<div className={`${PLATFORM_SURFACE_CARD_CLASS} mt-4 p-8 text-center`}><p className="font-black">Nenhum registro público corresponde aos filtros.</p></div>}{directory.pageInfo.pages>1?<nav aria-label="Paginação" className="mt-5 flex justify-between text-sm font-bold">{directory.pageInfo.page>1?<Link href={href(directory.pageInfo.page-1)}><ChevronLeft size={15} className="inline"/> Anterior</Link>:<span/>}<span>Página {directory.pageInfo.page} de {directory.pageInfo.pages}</span>{directory.pageInfo.page<directory.pageInfo.pages?<Link href={href(directory.pageInfo.page+1)}>Próxima <ChevronRight size={15} className="inline"/></Link>:<span/>}</nav>:null}</section>
  </article>;
}
