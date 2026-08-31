import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Rankings',
  description: 'Acompanhe rankings de concursos, simulados e desempenho entre candidatos na plataforma ConcursoMestre.',
  path: '/ranking',
});

export default function RankingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
