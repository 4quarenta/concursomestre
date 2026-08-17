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
import { buildNoIndexMetadata } from './seoMetadata';

export const metadata: Metadata = buildNoIndexMetadata({
  title: 'Página não encontrada',
  description: 'O endereço solicitado não existe ou não está mais disponível.',
});

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Erro 404</p>
      <h1 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">Página não encontrada</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
        O conteúdo pode ter mudado de endereço ou não estar mais disponível.
      </p>
      <Link href="/" className="mt-7 inline-flex h-11 items-center rounded-md bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700">
        Voltar ao início
      </Link>
    </section>
  );
}
