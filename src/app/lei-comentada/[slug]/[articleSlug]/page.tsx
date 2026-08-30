import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink, FileText, Scale } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import { buildNoIndexMetadata } from '../../../seoMetadata';
import { fetchPublicLawArticle, type PublicLawArticleDetail } from '../../lawArticleServerData';
import { buildLawArticleMetadata, lawArticleDescription, lawArticleHeading, lawArticleName } from '../../lawArticleMetadata';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string; articleSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const load = async (lawSlug: string, articleSlug: string) => {
  const result = await fetchPublicLawArticle(lawSlug, articleSlug);
  if (result && 'redirectPath' in result) permanentRedirect(result.redirectPath);
  return result && !('redirectPath' in result) ? result : null;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, articleSlug } = await params;
  const item = await load(slug, articleSlug);
  if (!item) return buildNoIndexMetadata({ title: 'Artigo normativo não encontrado' });
  return buildLawArticleMetadata(item, await searchParams);
}

const statusLabel = (status: string) => ({ revoked: 'Revogado', vetoed: 'Vetado' }[status] || null);

export default async function LawArticlePage({ params }: Props) {
  const { slug, articleSlug } = await params;
  const item = await load(slug, articleSlug);
  if (!item) notFound();
  const heading = lawArticleHeading(item); const summary = lawArticleDescription(item);
  const blocks = item.article.blocks.length ? item.article.blocks : [{ id: item.article.id, uid: 'official-text', kind: 'caput', label: null, text: item.article.officialText, parentUid: null, anchor: null, sortOrder: 0 }];
  const breadcrumbs = item.breadcrumbs.map((crumb) => ({ label: crumb.label, path: crumb.path }));
  const structuredData = buildStructuredDataGraph([
    { ...buildWebPage({ path: item.canonicalPath, name: heading, description: summary }), dateModified: item.article.updatedAt || item.law.updatedAt || undefined },
    buildBreadcrumbList(breadcrumbs),
  ]);
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <StructuredData value={structuredData} />
    <CanonicalBreadcrumbs items={breadcrumbs} />
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
      <p className="text-[10px] font-black uppercase text-indigo-700">Texto normativo oficial</p>
      <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{heading}</h1>
      {item.article.title ? <p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{item.article.title}</p> : null}
      {statusLabel(item.article.officialStatus) ? <p className="mt-4 inline-flex rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900">{statusLabel(item.article.officialStatus)}</p> : null}
      {item.section?.title ? <p className="mt-4 text-sm font-semibold text-slate-500">{item.section.title}</p> : null}
    </header>
    <section aria-labelledby="official-text-title" className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
      <h2 id="official-text-title" className="flex items-center gap-2 text-lg font-black"><Scale size={19} className="text-[#615fff]"/> Texto do artigo</h2>
      <div className="mt-5 space-y-4">{blocks.map((block) => <div key={block.uid || block.id} className="text-sm font-medium leading-7 text-slate-800 dark:text-slate-100">{block.label ? <strong className="mr-1 font-black">{block.label}</strong> : null}<span className="whitespace-pre-wrap">{block.text}</span></div>)}</div>
      {item.law.officialUrl ? <a href={item.law.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#615fff]"><ExternalLink size={16}/> Consultar fonte oficial</a> : null}
    </section>
    <nav aria-label="Navegação entre artigos" className="grid gap-3 sm:grid-cols-2">
      {item.navigation.previous ? <Link href={item.navigation.previous.path} className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-20 items-center gap-3 p-4 text-sm font-black`}><ArrowLeft size={18}/><span><span className="block text-xs text-slate-500">Artigo anterior</span>Art. {item.navigation.previous.number}</span></Link> : <span/>}
      {item.navigation.next ? <Link href={item.navigation.next.path} className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-20 items-center justify-end gap-3 p-4 text-right text-sm font-black`}><span><span className="block text-xs text-slate-500">Próximo artigo</span>Art. {item.navigation.next.number}</span><ArrowRight size={18}/></Link> : null}
    </nav>
    <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`} aria-labelledby="law-context-title"><h2 id="law-context-title" className="flex items-center gap-2 font-black"><FileText size={17} className="text-[#615fff]"/> Norma relacionada</h2><Link href={`/lei-comentada/${item.law.slug}`} className="mt-3 inline-block text-sm font-black text-[#615fff]">Ver {lawArticleName(item)} completa</Link></section>
  </article>;
}
