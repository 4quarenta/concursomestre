import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Configuração indisponível',
  description: 'Superfície técnica interna do ConcursoMestre.',
});

export default function SetupLayout({ children }: { children: ReactNode }) {
  return children;
}
