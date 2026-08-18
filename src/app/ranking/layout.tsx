import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Rankings',
  description: 'Acompanhe rankings de concursos, simulados e desempenho entre candidatos na plataforma ConcursoMestre.',
});

export default function RankingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
