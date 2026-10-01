import { Suspense, type ReactNode } from 'react';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'ConcursoMestre Elite',
  description: 'Conheca a experiencia Elite do ConcursoMestre para estudar com recursos avancados, acompanhamento e materiais premium.',
  path: '/elite',
});

export default function EliteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <StructuredData value={buildStructuredDataGraph([buildWebPage({ path: '/elite', name: 'ConcursoMestre Elite' })])} />
      <Suspense fallback={null}>{children}</Suspense>
    </>
  );
}
