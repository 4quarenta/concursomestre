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
import { ArrowRight, Clock3, TrendingUp } from 'lucide-react';
import { notFound } from 'next/navigation';
import { buildSiteUrl } from '@/config/siteUrl';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import BlogHeader from '../BlogHeader';
import BlogConversionCta from '../BlogConversionCta';
import BlogArticleEngagement from './BlogArticleEngagement';
import BlogShareBar from './BlogShareBar';
import { articlePopularity, formatBlogDateTime, publicationValue, wasMeaningfullyUpdated } from '../blogFormatters';
import { fetchBlogArticleForServer, fetchBlogPageForServer } from '../blogServerData';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import { buildBreadcrumbList, buildStructuredDataGraph } from '@services/seo/structuredData';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildNoIndexMetadata } from '@/app/seoMetadata';

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchBlogArticleForServer(slug);
  if (!article) return buildNoIndexMetadata({ title: 'Notícia não encontrada' });
  const canonical = publicRoutes.blog.article(article.slug);
  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    alternates: { canonical },
    authors: [{ name: article.author.name, url: publicRoutes.blog.author(article.author.id) }],
    openGraph: {
      type: 'article',
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      url: canonical,
      publishedTime: article.publishedAt || undefined,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
      tags: article.taxonomy.tags.map((tag) => tag.label),
      images: article.coverImageUrl ? [{ url: article.coverImageUrl, alt: article.coverImageAlt }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const [article, latestPage] = await Promise.all([
    fetchBlogArticleForServer(slug),
    fetchBlogPageForServer(),
  ]);
  if (!article) notFound();
  const canonicalPath = publicRoutes.blog.article(article.slug);
  const canonical = buildSiteUrl(canonicalPath);
  const related = latestPage.items
    .filter((item) => item.id !== article.id)
    .sort((left, right) => {
      const leftCategory = left.taxonomy.category.id === article.taxonomy.category.id ? 1 : 0;
      const rightCategory = right.taxonomy.category.id === article.taxonomy.category.id ? 1 : 0;
      return rightCategory - leftCategory || articlePopularity(right) - articlePopularity(left);
    })
    .slice(0, 5);
  const authorInitials = article.author.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const breadcrumbs = [
    { label: 'Início', path: '/' },
    { label: 'Blog', path: publicRoutes.blog.index() },
    { label: article.title, path: canonicalPath },
  ];
  const newsArticle = {
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'pt-BR',
    mainEntityOfPage: canonical,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: buildSiteUrl(publicRoutes.blog.author(article.author.id)),
    },
    publisher: {
      '@type': 'Organization',
      name: 'ConcursoMestre',
      url: buildSiteUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: buildSiteUrl('/branding/logo-dark.png'),
      },
    },
    isAccessibleForFree: true,
    articleSection: article.taxonomy.category.label,
    keywords: article.taxonomy.tags.map((tag) => tag.label).join(', '),
  };
  const jsonLd = buildStructuredDataGraph([newsArticle, buildBreadcrumbList(breadcrumbs)]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <StructuredData value={jsonLd} />
      <BlogHeader />
      <main>
        <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
            <CanonicalBreadcrumbs items={breadcrumbs} />
          </div>
        </div>

        <div className={`mx-auto grid gap-10 px-5 py-10 lg:px-8 ${related.length > 0 ? 'max-w-7xl lg:grid-cols-[minmax(0,780px)_320px]' : 'max-w-4xl'}`}>
          <article className="min-w-0">
            <Link href={publicRoutes.blog.category(article.taxonomy.category.slug)} className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
              {article.taxonomy.category.label}
            </Link>
            <h1 className="mt-3 text-4xl font-black leading-[1.08] text-slate-950 dark:text-white lg:text-5xl">{article.title}</h1>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{article.excerpt}</p>

            <div className="mt-7 flex flex-col gap-5 border-y border-slate-200 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200" aria-hidden="true">
                  {authorInitials || 'CM'}
                </span>
                <div className="text-sm">
                  <Link href={publicRoutes.blog.author(article.author.id)} className="font-black text-slate-900 hover:text-indigo-600 dark:text-white">{article.author.name}</Link>
                  <p className="mt-1 text-xs text-slate-500">
                    Publicado em <time dateTime={publicationValue(article)}>{formatBlogDateTime(publicationValue(article), 'long')}</time>
                  </p>
                  {wasMeaningfullyUpdated(article) ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Atualizado em <time dateTime={article.updatedAt}>{formatBlogDateTime(article.updatedAt, 'long')}</time>
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><Clock3 size={15} /> {article.readingMinutes} min de leitura</span>
            </div>

            <div className="mt-5">
              <BlogShareBar title={article.title} url={canonical} />
            </div>

            {article.coverImageUrl ? (
              <figure className="mt-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.coverImageUrl} alt={article.coverImageAlt} className="aspect-[16/9] w-full object-cover" />
                {article.coverImageAlt ? <figcaption className="mt-2 text-xs leading-5 text-slate-500">{article.coverImageAlt}</figcaption> : null}
              </figure>
            ) : null}

            <section className="mt-8 border-l-4 border-indigo-600 bg-indigo-50 px-5 py-4 dark:bg-indigo-950/40" aria-labelledby="article-summary-heading">
              <h2 id="article-summary-heading" className="text-sm font-black uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">Em resumo</h2>
              <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">{article.excerpt}</p>
            </section>

            <div className="mt-8">
              <BlogConversionCta tone="light" compact />
            </div>

            <div
              className="prose prose-slate mt-9 max-w-none text-base leading-8 dark:prose-invert prose-headings:scroll-mt-24 prose-headings:font-black prose-a:text-indigo-600 prose-img:max-h-[720px] prose-img:object-contain prose-table:block prose-table:max-w-full prose-table:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(article.bodyHtml || '') }}
            />

            {article.sourceName || article.sourceUrl ? (
              <p className="mt-8 border-l-2 border-slate-300 pl-4 text-xs text-slate-500">
                Fonte: {article.sourceUrl ? (
                  <a href={article.sourceUrl} rel="nofollow noopener noreferrer" target="_blank" className="font-bold text-indigo-600 hover:underline">
                    {article.sourceName || article.sourceUrl}
                  </a>
                ) : article.sourceName}
              </p>
            ) : null}

            {article.taxonomy.tags.length > 0 ? (
              <div className="mt-9 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-6 dark:border-slate-800">
                <span className="mr-1 text-xs font-black uppercase text-slate-500">Assuntos</span>
                {article.taxonomy.tags.map((tag) => (
                  <Link key={`${tag.id}-${tag.slug}`} href={publicRoutes.blog.tag(tag.slug)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {tag.label}
                  </Link>
                ))}
              </div>
            ) : null}

            <section className="mt-9 flex items-start gap-4 border-y border-slate-200 py-6 dark:border-slate-800" aria-label="Sobre o autor">
              <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-950 text-base font-black text-white dark:bg-white dark:text-slate-950" aria-hidden="true">{authorInitials || 'CM'}</span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Publicado por</p>
                <Link href={publicRoutes.blog.author(article.author.id)} className="mt-1 inline-block text-lg font-black text-slate-950 hover:text-indigo-600 dark:text-white">{article.author.name}</Link>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Equipe editorial do ConcursoMestre, com informações para acompanhar oportunidades e organizar a preparação.</p>
              </div>
            </section>

            <BlogArticleEngagement
              articleId={article.id}
              articleSlug={article.slug}
              initialLikesCount={article.engagement.likesCount}
              initialIsLiked={article.engagement.isLiked}
              allowComments={article.allowComments}
            />
          </article>

          {related.length > 0 ? (
            <aside className="self-start lg:sticky lg:top-5" aria-label="Conteúdo relacionado">
              <div className="border-t-4 border-indigo-600 bg-white px-5 dark:bg-slate-950">
                <h2 className="flex items-center gap-2 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-950 dark:text-white">
                  <TrendingUp size={17} className="text-indigo-600" /> Leia também
                </h2>
                {related.map((item, index) => (
                  <article key={item.id} className="grid grid-cols-[28px_1fr] gap-3 border-t border-slate-200 py-4 dark:border-slate-800">
                    <span className="text-xl font-black text-slate-300">{index + 1}</span>
                    <div>
                      <Link href={publicRoutes.blog.article(item.slug)} className="text-sm font-black leading-5 text-slate-900 hover:text-indigo-600 dark:text-white">{item.title}</Link>
                      <p className="mt-2 text-[11px] font-bold uppercase text-indigo-600">{item.taxonomy.category.label}</p>
                    </div>
                  </article>
                ))}
                <Link href={publicRoutes.blog.index()} className="mb-5 mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">Ver últimas notícias <ArrowRight size={14} /></Link>
              </div>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
