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
import { fetchBlogCategoriesForServer, fetchBlogPageForServer } from '../../blogServerData';
import { buildUnpromotedBlogTaxonomyMetadata } from '../../blogTaxonomyMetadata';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await fetchBlogCategoriesForServer();
  const category = categories.find((item) => item.slug === slug);
  return buildUnpromotedBlogTaxonomyMetadata({
    title: category ? `${category.label}: notícias e editais` : 'Categoria do blog',
    description: category?.description || `Notícias e atualizações sobre ${category?.label || 'concursos públicos'}.`,
    path: `/blog/categoria/${slug}`,
  });
}

export default async function BlogCategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { cursor = '' } = await searchParams;
  const [page, categories] = await Promise.all([
    fetchBlogPageForServer({ category: slug, cursor }),
    fetchBlogCategoriesForServer(),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <BlogHeader />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Categoria</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{category.label}</h1>
        {category.description ? <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">{category.description}</p> : null}
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {page.items.map((article) => <BlogArticleCard key={article.id} article={article} />)}
        </div>
        {page.pageInfo.hasMore && page.pageInfo.nextCursor ? (
          <div className="mt-9 flex justify-center">
            <Link
              href={{
                pathname: `/blog/categoria/${slug}`,
                query: { cursor: page.pageInfo.nextCursor },
              }}
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
