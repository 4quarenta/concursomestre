import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Changelog',
  description: 'Acompanhe as principais mudancas, melhorias e correcoes publicadas na plataforma ConcursoMestre.',
  path: '/changelog',
});

export default function ChangelogLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
