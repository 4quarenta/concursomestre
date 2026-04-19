import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Desempenho',
});

export default function PerformanceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
