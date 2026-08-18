import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Níveis',
  description: 'Acompanhe seu nível e progresso dentro da plataforma ConcursoMestre.',
});

export default function LevelsLayout({ children }: { children: ReactNode }) {
  return children;
}
