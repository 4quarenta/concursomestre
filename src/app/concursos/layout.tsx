import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Concursos',
  description: 'Explore concursos por banca, orgao, cargo e ano para encontrar questoes, rankings e materiais relacionados.',
  path: '/concursos',
});

export default function ConcursosLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
