import { Suspense, type ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'ConcursoMestre Elite',
  description: 'Conheca a experiencia Elite do ConcursoMestre para estudar com recursos avancados, acompanhamento e materiais premium.',
  path: '/elite',
});

export default function EliteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
