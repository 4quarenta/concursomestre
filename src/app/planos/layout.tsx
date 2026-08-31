import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Planos',
  description: 'Compare os planos do ConcursoMestre e escolha o melhor ciclo para estudar com questoes, simulados e acompanhamento de desempenho.',
  path: '/planos',
});

export default function PlanosLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
