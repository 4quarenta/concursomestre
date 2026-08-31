import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Simulado',
});

export default function SimulationLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
