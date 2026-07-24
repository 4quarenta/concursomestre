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
import BrandLogo from '@/components/shared/layout/BrandLogo';

export default function BlogHeader() {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="relative mx-auto flex max-w-7xl items-center px-5 py-4 min-[360px]:pr-28 md:pr-64 lg:px-8 lg:pr-72">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="inline-flex items-center transition-opacity hover:opacity-90" aria-label="Ir para a página inicial do ConcursoMestre">
            <BrandLogo width={180} priority variant="adaptive" alt="ConcursoMestre" />
          </Link>
          <span className="hidden border-l border-slate-200 pl-5 text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:block">
            Notícias
          </span>
        </div>
        <nav className="absolute right-5 top-1/2 hidden -translate-y-1/2 items-center gap-2 text-sm font-bold min-[360px]:flex lg:right-8">
          <Link href="/blog" className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 md:inline-flex">
            Blog
          </Link>
          <Link href="/practice" className="hidden px-3 py-2 text-slate-700 hover:text-indigo-600 dark:text-slate-200 md:inline-flex">
            Questões
          </Link>
          <Link href="/auth" className="rounded-md bg-slate-950 px-4 py-2 text-white hover:bg-indigo-700 dark:bg-white dark:text-slate-950">
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}
