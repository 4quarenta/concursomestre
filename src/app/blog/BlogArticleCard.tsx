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

import Link from 'next/link';
import { Clock3, MessageSquare, ThumbsUp } from 'lucide-react';
import type { BlogArticleCardItem } from '@services/blog';
import { formatBlogDateTime, publicationValue } from './blogFormatters';

export default function BlogArticleCard({
  article,
  featured = false,
  compact = false,
}: {
  article: BlogArticleCardItem;
  featured?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <article className="border-b border-slate-200 py-4 last:border-b-0 dark:border-slate-800">
        <Link href={`/blog/categoria/${article.taxonomy.category.slug}`} className="text-[10px] font-black uppercase text-indigo-600">
          {article.taxonomy.category.label}
        </Link>
        <h3 className="mt-2 text-base font-black leading-6 text-slate-950 dark:text-white">
          <Link href={`/blog/${article.slug}`} className="hover:text-indigo-600">{article.title}</Link>
        </h3>
        <time dateTime={publicationValue(article)} className="mt-2 block text-xs text-slate-500">
          {formatBlogDateTime(publicationValue(article), 'medium')}
        </time>
      </article>
    );
  }

  return (
    <article className={featured
      ? `overflow-hidden border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${article.coverImageUrl ? 'grid gap-0 lg:grid-cols-[1.15fr_1fr]' : ''}`
      : 'overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}>
      {article.coverImageUrl ? (
        <Link href={`/blog/${article.slug}`} className="block overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.coverImageUrl}
            alt={article.coverImageAlt}
            className={`w-full object-cover transition-transform duration-300 hover:scale-[1.02] ${featured ? 'aspect-[16/10] h-full' : 'aspect-[16/9]'}`}
          />
        </Link>
      ) : null}
      <div className={featured ? 'flex flex-col justify-center p-7 lg:p-10' : 'p-5'}>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.12em] text-indigo-600">
          <Link href={`/blog/categoria/${article.taxonomy.category.slug}`}>{article.taxonomy.category.label}</Link>
          <span className="text-slate-300">•</span>
          <time dateTime={publicationValue(article)} className="text-slate-500 dark:text-slate-400">
            {formatBlogDateTime(publicationValue(article), 'medium')}
          </time>
        </div>
        <h2 className={`mt-3 font-black leading-tight text-slate-950 dark:text-white ${featured ? 'text-3xl lg:text-4xl' : 'text-xl'}`}>
          <Link href={`/blog/${article.slug}`} className="hover:text-indigo-600">
            {article.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{article.excerpt}</p>
        {article.taxonomy.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Tags da notícia">
            {article.taxonomy.tags.slice(0, featured ? 4 : 3).map((tag) => (
              <Link key={tag.id ?? tag.slug} href={`/blog/tag/${tag.slug}`} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-indigo-950">
                {tag.label}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <Link href={`/blog/autor/${article.author.id}`} className="hover:text-indigo-600">
            Por {article.author.name}
          </Link>
          <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {article.readingMinutes} min</span>
          <span className="inline-flex items-center gap-1"><ThumbsUp size={14} /> {article.engagement.likesCount}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {article.engagement.commentsCount}</span>
        </div>
      </div>
    </article>
  );
}
