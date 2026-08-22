import { Suspense, type ReactNode } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'ConcursoMestre Elite',
  description: 'Conheca a experiencia Elite do ConcursoMestre para estudar com recursos avancados, acompanhamento e materiais premium.',
  path: '/elite',
});

export default function EliteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Elite', path: '/elite' }];
  return (
    <>
      <StructuredData value={buildStructuredDataGraph([buildWebPage({ path: '/elite', name: 'ConcursoMestre Elite' }), buildBreadcrumbList(breadcrumbs)])} />
      <div className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-8"><CanonicalBreadcrumbs items={breadcrumbs} /></div>
      <Suspense fallback={null}>{children}</Suspense>
    </>
  );
}
