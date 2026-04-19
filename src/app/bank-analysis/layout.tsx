import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Analise de banca',
});

export default function BankAnalysisLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
