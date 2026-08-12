import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Novidades',
  description: 'Veja o que chegou recentemente ao ConcursoMestre.',
  path: '/novidades',
});

export default function ChangelogLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
