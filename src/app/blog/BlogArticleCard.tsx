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
import type { BlogArticle } from '@services/blog';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
};

export default function BlogArticleCard({ article, featured = false }: { article: BlogArticle; featured?: boolean }) {
  return (
    <article className={featured ? 'grid gap-0 overflow-hidden border-y border-slate-200 bg-white lg:grid-cols-[1.15fr_1fr] dark:border-slate-800 dark:bg-slate-950' : 'overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}>
      <Link href={`/blog/${article.slug}`} className="block overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.coverImageUrl}
          alt={article.coverImageAlt}
          className={`w-full object-cover transition-transform duration-300 hover:scale-[1.02] ${featured ? 'aspect-[16/10] h-full' : 'aspect-[16/9]'}`}
        />
      </Link>
      <div className={featured ? 'flex flex-col justify-center p-7 lg:p-10' : 'p-5'}>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.12em] text-indigo-600">
          <Link href={`/blog/categoria/${article.category.slug}`}>{article.category.name}</Link>
          <span className="text-slate-300">•</span>
          <time className="text-slate-500 dark:text-slate-400">{formatDate(article.publishedAt)}</time>
        </div>
        <h2 className={`mt-3 font-black leading-tight text-slate-950 dark:text-white ${featured ? 'text-3xl lg:text-4xl' : 'text-xl'}`}>
          <Link href={`/blog/${article.slug}`} className="hover:text-indigo-600">
            {article.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{article.excerpt}</p>
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
