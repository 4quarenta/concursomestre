import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import 'katex/dist/katex.min.css';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildPublicPageMetadata({
  title: 'Questões de concursos para praticar',
  description: 'Resolva questões de concursos por matéria, banca, órgão, cargo, ano e dificuldade, com estatísticas e comentários no ConcursoMestre.',
  path: '/practice',
});

export default function PracticeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
