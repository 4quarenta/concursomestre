import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ExternalLink, FileText, ShoppingBag, UserRound } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import type { PublicMaterialDetail } from './materialServerData';
import { materialDescription } from './materialMetadata';

const offerLabel = (item: PublicMaterialDetail) => {
  if (item.offer.mode === 'free') return 'Acesso gratuito';
  if (item.offer.mode === 'paid' && item.offer.amountMinor != null && item.offer.currency === 'BRL') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.offer.amountMinor / 100);
  if (item.offer.mode === 'included_in_plan') return 'Incluído em plano';
  if (item.offer.mode === 'unavailable') return 'Oferta indisponível';
  return 'Não disponível para compra';
};

export default function MaterialDetail({ item }: { item: PublicMaterialDetail }) {
  const description = materialDescription(item);
  const breadcrumbs = item.breadcrumbs.map((crumb) => ({ label: crumb.label, path: crumb.canonicalPath }));
  const structuredData = buildStructuredDataGraph([
    buildWebPage({ path: item.canonicalPath, name: item.title, description }),
    buildBreadcrumbList(breadcrumbs),
  ]);
  const marketplaceHref = `${item.marketplacePath}?openMaterial=${encodeURIComponent(item.id)}`;
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <StructuredData value={structuredData} />
    <CanonicalBreadcrumbs items={breadcrumbs} />
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><div className="flex flex-col gap-5 sm:flex-row">{item.coverUrl?<Image src={item.coverUrl} alt={`Capa de ${item.title}`} width={160} height={220} unoptimized className="aspect-[3/4] h-auto w-32 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-700"/>:<span className="grid aspect-[3/4] w-32 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800"><FileText size={36}/></span>}<div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase text-indigo-700">Material editorial público</p><h1 className={`mt-2 break-words ${PLATFORM_PAGE_TITLE_CLASS}`}>{item.title}</h1><p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">{item.format?<span className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">{item.format}</span>:null}{item.pageCount?<span className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">{item.pageCount} páginas</span>:null}{item.year?<span className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">{item.year}</span>:null}<span className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">{offerLabel(item)}</span></div>{item.publicAuthorName?<p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500"><UserRound size={15}/>{item.publicAuthorName}</p>:null}</div></div>
      <div className="mt-5 flex flex-wrap gap-3">{item.listingReadiness.status==='READY'?<Link href={marketplaceHref} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#615fff] px-4 text-xs font-black text-white"><ShoppingBag size={15}/> Ver oferta no marketplace</Link>:<span className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-xs font-black text-slate-500 dark:border-slate-700">Sem oferta disponível no momento</span>}{item.previewUrl?<a href={item.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-xs font-black dark:border-slate-700">Abrir prévia pública <ExternalLink size={14}/></a>:null}</div>
    </header>
    {item.taxonomies.length?<section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`} aria-labelledby="material-taxonomies"><h2 id="material-taxonomies" className="flex items-center gap-2 font-black"><BookOpen size={17} className="text-[#615fff]"/> Conteúdo relacionado</h2><div className="mt-4 flex flex-wrap gap-2">{item.taxonomies.map((taxonomy)=><Link key={`${taxonomy.relationType}-${taxonomy.id}`} href={taxonomy.path} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold hover:text-[#615fff] dark:border-slate-700">{taxonomy.name}</Link>)}</div></section>:null}
    <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="font-black">Acesso e segurança</h2><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">A página apresenta apenas informações públicas. O arquivo completo, quando disponível, exige autorização no servidor e não é incorporado nesta landing.</p></section>
  </article>;
}
