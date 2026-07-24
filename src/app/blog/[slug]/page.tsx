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
import { buildSiteUrl } from '@/config/siteUrl';
import BlogHeader from '../BlogHeader';
import BlogArticleEngagement from './BlogArticleEngagement';
import { fetchBlogArticleForServer } from '../blogServerData';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import { serializeStructuredData } from '@services/seo/structuredData';

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchBlogArticleForServer(slug);
  if (!article) return { title: 'Notícia não encontrada', robots: { index: false } };
  const canonical = article.canonicalUrl || `/blog/${article.slug}`;
  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    alternates: { canonical },
    authors: [{ name: article.author.name, url: `/blog/autor/${article.author.id}` }],
    openGraph: {
      type: 'article',
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      url: canonical,
      publishedTime: article.publishedAt || undefined,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
      images: [{ url: article.coverImageUrl, alt: article.coverImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      images: [article.coverImageUrl],
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await fetchBlogArticleForServer(slug);
  if (!article) notFound();
  const canonical = article.canonicalUrl || buildSiteUrl(`/blog/${article.slug}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: [article.coverImageUrl],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'pt-BR',
    mainEntityOfPage: canonical,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: buildSiteUrl(`/blog/autor/${article.author.id}`),
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
    articleSection: article.category.name,
    keywords: article.tags.map((tag) => tag.name).join(', '),
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />
      <BlogHeader />
      <main className="mx-auto max-w-4xl px-5 py-10 lg:px-8">
        <nav className="text-xs font-bold text-slate-500">
          <Link href="/blog" className="hover:text-indigo-600">Blog</Link>
          <span className="px-2">/</span>
          <Link href={`/blog/categoria/${article.category.slug}`} className="hover:text-indigo-600">{article.category.name}</Link>
        </nav>
        <article className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">{article.category.name}</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-950 dark:text-white lg:text-5xl">{article.title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{article.excerpt}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
            <Link href={`/blog/autor/${article.author.id}`} className="hover:text-indigo-600">Por {article.author.name}</Link>
            <span>•</span>
            <time>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(article.publishedAt || article.createdAt))}</time>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.coverImageUrl} alt={article.coverImageAlt} className="mt-8 aspect-[16/9] w-full object-cover" />
          <div
            className="prose prose-slate mt-9 max-w-none text-base leading-8 dark:prose-invert prose-headings:font-black prose-a:text-indigo-600 prose-img:max-h-[720px] prose-img:object-contain"
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
          <BlogArticleEngagement
            articleId={article.id}
            articleSlug={article.slug}
            initialLikesCount={article.engagement.likesCount}
            initialIsLiked={article.engagement.isLiked}
            allowComments={article.allowComments}
          />
        </article>
      </main>
    </div>
  );
}
