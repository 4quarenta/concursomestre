import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Questoes comentadas',
  description: 'Resolva questoes de concursos com comentarios, estatisticas, filtros e historico de desempenho.',
  path: '/question',
});

export default function QuestionLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
