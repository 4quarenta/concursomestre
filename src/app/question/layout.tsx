import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import 'katex/dist/katex.min.css';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildPublicPageMetadata({
  title: 'Questões comentadas',
  description: 'Resolva questões de concursos com comentários, estatísticas, filtros e histórico de desempenho.',
  path: '/question',
});

export default function QuestionLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
