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
import { buildSiteUrl } from '@/config/siteUrl';
import BlogArticleCard from './BlogArticleCard';
import BlogHeader from './BlogHeader';
import { fetchBlogCategoriesForServer, fetchBlogPageForServer } from './blogServerData';
import { serializeStructuredData } from '@services/seo/structuredData';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Notícias de concursos, editais e carreiras',
  description: 'Notícias, editais, prazos e análises para quem estuda para concursos públicos.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog ConcursoMestre',
    description: 'Notícias, editais e análises para concursos públicos.',
    url: '/blog',
    type: 'website',
  },
};

type BlogPageProps = {
  searchParams: Promise<{ cursor?: string }>;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { cursor = '' } = await searchParams;
  const [page, featuredPage, categories] = await Promise.all([
    fetchBlogPageForServer({ cursor }),
    fetchBlogPageForServer({ featured: true }),
    fetchBlogCategoriesForServer(),
  ]);
  const featured = cursor ? null : (featuredPage.items[0] || page.items[0]);
  const articles = featured
    ? page.items.filter((article) => article.id !== featured.id)
    : page.items;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Blog ConcursoMestre',
    url: buildSiteUrl('/blog'),
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: page.items.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildSiteUrl(`/blog/${article.slug}`),
        name: article.title,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />
      <BlogHeader />
      <main>
        <section className="mx-auto max-w-7xl px-5 pb-8 pt-10 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">ConcursoMestre Notícias</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-slate-950 dark:text-white lg:text-5xl">
            Informação útil para decidir o próximo passo da sua aprovação
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Editais, prazos, carreiras e análises objetivas, organizados para quem precisa estudar e agir.
          </p>
          {categories.length > 0 ? (
            <nav className="mt-7 flex flex-wrap gap-2" aria-label="Categorias do blog">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/blog/categoria/${category.slug}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {category.name} {category.articleCount ? `(${category.articleCount})` : ''}
                </Link>
              ))}
            </nav>
          ) : null}
        </section>

        {featured ? (
          <section className="mx-auto max-w-7xl px-5 lg:px-8">
            <BlogArticleCard article={featured} featured />
          </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Últimas publicações</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Acompanhe as novidades</h2>
            </div>
            <Link href="/blog/feed.xml" className="text-xs font-bold text-indigo-600 hover:underline">RSS</Link>
          </div>
          {articles.length > 0 ? (
            <>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {articles.map((article) => <BlogArticleCard key={article.id} article={article} />)}
              </div>
              {page.pageInfo.hasMore && page.pageInfo.nextCursor ? (
                <div className="mt-9 flex justify-center">
                  <Link
                    href={{ pathname: '/blog', query: { cursor: page.pageInfo.nextCursor } }}
                    className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    Mais notícias
                  </Link>
                </div>
              ) : null}
            </>
          ) : featured ? null : (
            <div className="border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-950">
              <p className="font-bold text-slate-700 dark:text-slate-200">As primeiras notícias estão sendo preparadas.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
