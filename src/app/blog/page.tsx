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
import { ArrowRight, MapPin, Newspaper, SearchX, Tags, TrendingUp } from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import BlogArticleCard from './BlogArticleCard';
import BlogConversionCta from './BlogConversionCta';
import BlogExamDirectory from './BlogExamDirectory';
import BlogHeader from './BlogHeader';
import { articlePopularity, formatBlogDateTime, publicationValue } from './blogFormatters';
import {
  fetchBlogCategoriesForServer,
  fetchBlogPageForServer,
  fetchBlogTagsForServer,
  fetchPublicExamDirectoryForServer,
} from './blogServerData';
import { serializeStructuredData } from '@services/seo/structuredData';
import type { BlogArticle } from '@services/blog';
import { buildPublicPageMetadata } from '../seoMetadata';
import { launchModeRobots } from '@services/seo/launchControl';

export const revalidate = 300;

type BlogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const BLOG_TITLE = 'Notícias de concursos, editais e carreiras';
const BLOG_DESCRIPTION = 'Notícias, editais, prazos e análises para quem estuda para concursos públicos.';

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const query = await searchParams;
  const metadata = buildPublicPageMetadata({ title: BLOG_TITLE, description: BLOG_DESCRIPTION, path: '/blog' });
  return Object.keys(query).length > 0 ? { ...metadata, robots: launchModeRobots(true) } : metadata;
}

const uniqueArticles = (articles: BlogArticle[]): BlogArticle[] => (
  Array.from(new Map(articles.map((article) => [article.id, article])).values())
);

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const query = await searchParams;
  const cursor = typeof query.cursor === 'string' ? query.cursor : '';
  const search = (typeof query.q === 'string' ? query.q : '').trim().slice(0, 160);
  const [page, categories, tags, exams] = await Promise.all([
    fetchBlogPageForServer({ cursor, search }),
    fetchBlogCategoriesForServer(),
    fetchBlogTagsForServer(),
    !cursor && !search ? fetchPublicExamDirectoryForServer(24) : Promise.resolve([]),
  ]);
  const articles = uniqueArticles(page.items);
  const lead = !cursor && !search ? (articles.find((article) => article.featured) || articles[0] || null) : null;
  const secondary = lead ? articles.filter((article) => article.id !== lead.id).slice(0, 4) : [];
  const latest = lead
    ? articles.filter((article) => article.id !== lead.id && !secondary.some((item) => item.id === article.id))
    : articles;
  const mostRead = [...articles]
    .sort((left, right) => articlePopularity(right) - articlePopularity(left))
    .slice(0, 5);
  const categorySections = categories
    .map((category) => ({
      category,
      articles: articles.filter((article) => article.taxonomy.category.slug === category.slug).slice(0, 4),
    }))
    .filter((section) => section.articles.length > 0)
    .slice(0, 4);
  const regionalTags = tags
    .filter((tag) => tag.kind === 'region' || tag.kind === 'state')
    .sort((left, right) => (right.articleCount || 0) - (left.articleCount || 0))
    .slice(0, 14);
  const discoveryTags = tags
    .filter((tag) => tag.kind !== 'region' && tag.kind !== 'state')
    .sort((left, right) => (right.articleCount || 0) - (left.articleCount || 0))
    .slice(0, 14);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Blog ConcursoMestre',
    url: buildSiteUrl('/blog'),
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((article, index) => ({
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
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">ConcursoMestre Notícias</p>
                <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 dark:text-white lg:text-4xl">
                  {search ? `Resultados para “${search}”` : 'Concursos públicos em pauta'}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  {search
                    ? `${articles.length} notícia(s) encontrada(s) nesta página.`
                    : 'Editais, prazos, carreiras e análises para transformar informação em decisão de estudo.'}
                </p>
              </div>
              <Link href="/blog/feed.xml" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline">
                <Newspaper size={16} /> Acompanhar por RSS
              </Link>
            </div>
          </div>
        </section>

        {lead ? (
          <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.7fr)] lg:px-8">
            <BlogArticleCard article={lead} featured />
            {secondary.length > 0 ? (
              <aside className="border-t-4 border-slate-950 bg-white px-5 dark:border-white dark:bg-slate-950" aria-label="Outras notícias em destaque">
                <h2 className="py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 dark:text-white">Em destaque</h2>
                {secondary.map((article) => <BlogArticleCard key={article.id} article={article} compact />)}
              </aside>
            ) : null}
          </section>
        ) : null}

        {!search && !cursor ? <BlogConversionCta tone="light" compact /> : null}

        {!search && !cursor && exams.length > 0 ? <BlogExamDirectory items={exams} compact /> : null}

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <div className="min-w-0">
            <div className="mb-6 flex items-center justify-between border-b border-slate-300 pb-3 dark:border-slate-700">
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                {search ? 'Notícias encontradas' : cursor ? 'Mais notícias' : 'Últimas notícias'}
              </h2>
            </div>
            {latest.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {latest.map((article) => <BlogArticleCard key={article.id} article={article} />)}
              </div>
            ) : lead ? (
              <p className="py-8 text-sm text-slate-500">Acompanhe esta página para receber as próximas publicações.</p>
            ) : (
              <div className="border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-950">
                <SearchX className="mx-auto text-slate-300" size={38} />
                <p className="mt-4 font-bold text-slate-700 dark:text-slate-200">Nenhuma notícia encontrada.</p>
                <Link href="/blog" className="mt-4 inline-flex text-sm font-bold text-indigo-600 hover:underline">Limpar busca</Link>
              </div>
            )}
            {page.pageInfo.hasMore && page.pageInfo.nextCursor ? (
              <div className="mt-9 flex justify-center">
                <Link
                  href={{ pathname: '/blog', query: { cursor: page.pageInfo.nextCursor, ...(search ? { q: search } : {}) } }}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  Mais notícias
                </Link>
              </div>
            ) : null}
          </div>

          {mostRead.length > 0 ? (
            <aside className="self-start border-t-4 border-indigo-600 bg-white px-5 dark:bg-slate-950" aria-label="Notícias mais lidas">
              <h2 className="flex items-center gap-2 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 dark:text-white">
                <TrendingUp size={17} className="text-indigo-600" /> Mais lidas
              </h2>
              <ol>
                {mostRead.map((article, index) => (
                  <li key={article.id} className="grid grid-cols-[28px_1fr] gap-3 border-t border-slate-200 py-4 dark:border-slate-800">
                    <span className="text-xl font-black text-slate-300">{index + 1}</span>
                    <div>
                      <Link href={`/blog/${article.slug}`} className="text-sm font-black leading-5 text-slate-900 hover:text-indigo-600 dark:text-white">
                        {article.title}
                      </Link>
                      <time dateTime={publicationValue(article)} className="mt-2 block text-[11px] text-slate-500">
                        {formatBlogDateTime(publicationValue(article), 'medium')}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}
        </section>

        {!search && !cursor && categorySections.length > 0 ? (
          <section className="border-y border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
            <div className="mx-auto max-w-7xl space-y-10 px-5 lg:px-8">
              {categorySections.map(({ category, articles: categoryArticles }) => (
                <div key={category.id}>
                  <div className="mb-5 flex items-end justify-between border-b border-slate-300 pb-3 dark:border-slate-700">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">Editoria</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{category.label}</h2>
                    </div>
                    <Link href={`/blog/categoria/${category.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
                      Ver tudo <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    {categoryArticles.map((article) => <BlogArticleCard key={article.id} article={article} />)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!search && !cursor && (regionalTags.length > 0 || discoveryTags.length > 0) ? (
          <section className="border-b border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-2 lg:px-8">
              {regionalTags.length > 0 ? (
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white"><MapPin size={18} className="text-indigo-600" /> Notícias por região</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {regionalTags.map((tag) => (
                      <Link key={tag.id} href={`/blog/tag/${tag.slug}`} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        {tag.label}<span className="text-xs font-medium text-slate-400">{tag.articleCount || 0}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {discoveryTags.length > 0 ? (
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white"><Tags size={18} className="text-indigo-600" /> Assuntos em destaque</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {discoveryTags.map((tag) => (
                      <Link key={tag.id} href={`/blog/tag/${tag.slug}`} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        {tag.label}<span className="text-xs font-medium text-slate-400">{tag.articleCount || 0}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <BlogConversionCta />
      </main>
    </div>
  );
}
