import type { ReactNode } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Termos de uso',
  description: 'Leia os termos de uso que regulam o acesso e a utilizacao da plataforma ConcursoMestre.',
  path: '/terms',
});

export default function TermsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Termos de Uso', path: '/terms' }];
  return <><StructuredData value={buildStructuredDataGraph([buildWebPage({ path: '/terms', name: 'Termos de Uso do ConcursoMestre' }), buildBreadcrumbList(breadcrumbs)])} /><div data-semantic-content className="mx-auto w-full max-w-6xl px-4 pt-6"><CanonicalBreadcrumbs items={breadcrumbs} /></div>{children}</>;
}
