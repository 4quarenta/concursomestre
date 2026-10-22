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
import { MapPin, Search } from 'lucide-react';
import { fetchBlogCategoriesForServer, fetchBlogTagsForServer } from './blogServerData';

export default async function BlogHeader() {
  const [categories, tags] = await Promise.all([
    fetchBlogCategoriesForServer(),
    fetchBlogTagsForServer(),
  ]);
  const regionalTags = tags
    .filter((tag) => tag.kind === 'region' || tag.kind === 'state')
    .sort((left, right) => (right.articleCount || 0) - (left.articleCount || 0))
    .slice(0, 10);

  return (
    <section aria-label="Navegação do blog" className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-100 dark:border-slate-900">
        <div className="mx-auto flex w-full flex-col gap-3 px-5 py-3 md:max-w-7xl md:flex-row md:items-center md:px-0">
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1 lg:pb-0" aria-label="Editorias do blog">
            <Link href="/blog" className="whitespace-nowrap rounded-md bg-slate-950 px-3 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-950">
              Últimas
            </Link>
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={`/blog/categoria/${category.slug}`}
                className="whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                {category.label}
              </Link>
            ))}
          </nav>
          <form action="/blog" method="get" className="relative w-full lg:w-72">
            <label htmlFor="blog-header-search" className="sr-only">Buscar notícias</label>
            <input
              id="blog-header-search"
              name="q"
              type="search"
              maxLength={160}
              placeholder="Buscar notícias"
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:text-indigo-600" aria-label="Buscar">
              <Search size={17} />
            </button>
          </form>
        </div>
        {regionalTags.length > 0 ? (
          <nav className="mx-auto flex w-full items-center gap-2 overflow-x-auto px-5 py-2 text-xs md:max-w-7xl md:px-0" aria-label="Notícias por região">
            <span className="inline-flex shrink-0 items-center gap-1 font-black uppercase text-slate-400"><MapPin size={13} /> Regiões</span>
            {regionalTags.map((tag) => (
              <Link key={tag.id} href={`/blog/tag/${tag.slug}`} className="shrink-0 rounded-md px-2 py-1 font-bold text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-900">
                {tag.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
