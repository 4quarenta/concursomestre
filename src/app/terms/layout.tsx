import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Termos de uso',
  description: 'Leia os termos de uso que regulam o acesso e a utilizacao da plataforma ConcursoMestre.',
  path: '/terms',
});

export default function TermsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
