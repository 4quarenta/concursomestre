import type { ReactNode } from 'react';
import Link from 'next/link';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Suporte',
  description: 'Abra uma solicitação, relate problemas, envie sugestões e acompanhe o atendimento do ConcursoMestre.',
  path: '/support',
});

export default function SupportLayout({ children }: Readonly<{ children: ReactNode }>) {
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Suporte', path: '/support' }];
  const structuredData = buildStructuredDataGraph([
    buildWebPage({ path: '/support', name: 'Suporte ConcursoMestre', description: 'Canais oficiais de ajuda e atendimento do ConcursoMestre.' }),
    buildBreadcrumbList(breadcrumbs),
  ]);
  return (
    <>
      <StructuredData value={structuredData} />
      <header className="mx-auto w-full max-w-7xl px-3 pb-6 sm:px-4 md:px-0" data-semantic-content>
        <CanonicalBreadcrumbs items={breadcrumbs} />
        <p className="mt-5 text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">Atendimento</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">Como podemos ajudar?</h1>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
          Envie uma dúvida, relate um problema ou compartilhe uma sugestão pelos canais oficiais da plataforma.
        </p>
        <nav aria-label="Canais de suporte" className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/support?category=bug" className="text-indigo-700 hover:underline dark:text-indigo-300">Reportar problema</Link>
          <Link href="/support?category=feedback" className="text-indigo-700 hover:underline dark:text-indigo-300">Enviar sugestão</Link>
          <Link href="/profile/support-history" className="text-indigo-700 hover:underline dark:text-indigo-300">Meus atendimentos</Link>
        </nav>
      </header>
      {children}
    </>
  );
}
