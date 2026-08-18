import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '../seoMetadata';

const baseMetadata = buildPublicPageMetadata({
  title: 'Concursos',
  description: 'Explore concursos por banca, orgao, cargo e ano para encontrar questoes, rankings e materiais relacionados.',
  path: '/concursos',
});

export const metadata: Metadata = {
  ...baseMetadata,
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default function ConcursosLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
