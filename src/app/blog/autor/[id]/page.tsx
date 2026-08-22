/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogArticleCard from '../../BlogArticleCard';
import BlogHeader from '../../BlogHeader';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { fetchBlogPageForServer } from '../../blogServerData';
import { buildUnpromotedBlogTaxonomyMetadata } from '../../blogTaxonomyMetadata';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildBreadcrumbList, buildCollectionPage, buildItemList, buildStructuredDataGraph } from '@services/seo/structuredData';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const page = await fetchBlogPageForServer({ author: id });
  const author = page.items[0]?.author;
  return buildUnpromotedBlogTaxonomyMetadata({
    title: author ? `Artigos de ${author.name}` : 'Autor do blog',
    description: author ? `Notícias e análises publicadas por ${author.name} no ConcursoMestre.` : 'Autor do blog ConcursoMestre.',
    path: `/blog/autor/${id}`,
  });
}

export default async function BlogAuthorPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { cursor = '' } = await searchParams;
  const page = await fetchBlogPageForServer({ author: id, cursor });
  const author = page.items[0]?.author;
  if (!author) notFound();
  const canonicalPath = publicRoutes.blog.author(id);
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Blog', path: publicRoutes.blog.index() }, { label: author.name, path: canonicalPath }];
  const itemList = buildItemList(page.items.map((article) => ({ name: article.title, path: publicRoutes.blog.article(article.slug) })));
  const structuredData = buildStructuredDataGraph([
    { ...buildCollectionPage({ path: canonicalPath, name: `Artigos de ${author.name}` }), mainEntity: itemList },
    buildBreadcrumbList(breadcrumbs),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <StructuredData value={structuredData} />
      <BlogHeader />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <CanonicalBreadcrumbs items={breadcrumbs} className="mb-6" />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Autor</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{author.name}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Notícias e análises publicadas no ConcursoMestre.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {page.items.map((article) => <BlogArticleCard key={article.id} article={article} />)}
        </div>
        {page.pageInfo.hasMore && page.pageInfo.nextCursor ? (
          <div className="mt-9 flex justify-center">
            <Link
              href={{ pathname: canonicalPath, query: { cursor: page.pageInfo.nextCursor } }}
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              Mais notícias
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
