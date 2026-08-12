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
import BrandLogo from '@/components/shared/layout/BrandLogo';
import BlogAccountAction from './BlogAccountAction';
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
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <Link href="/" className="inline-flex min-w-0 items-center transition-opacity hover:opacity-90" aria-label="Ir para a página inicial do ConcursoMestre">
            <BrandLogo width={180} priority variant="adaptive" alt="ConcursoMestre" />
          </Link>
          <span className="hidden border-l border-slate-200 pl-5 text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:block">
            Notícias
          </span>
        </div>
        <nav className="flex shrink-0 items-center gap-1 text-sm font-bold sm:gap-2" aria-label="Navegação principal do blog">
          <Link href="/practice" className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 md:inline-flex">
            Questões
          </Link>
          <Link href="/blog/provas" className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 md:inline-flex">
            Provas
          </Link>
          <Link href="/blog" className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 sm:inline-flex">
            Notícias
          </Link>
          <BlogAccountAction />
        </nav>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:px-8">
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
          <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto border-t border-slate-100 px-5 py-2 text-xs dark:border-slate-900 lg:px-8" aria-label="Notícias por região">
            <span className="inline-flex shrink-0 items-center gap-1 font-black uppercase text-slate-400"><MapPin size={13} /> Regiões</span>
            {regionalTags.map((tag) => (
              <Link key={tag.id} href={`/blog/tag/${tag.slug}`} className="shrink-0 rounded-md px-2 py-1 font-bold text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-900">
                {tag.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
