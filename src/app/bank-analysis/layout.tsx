import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Raio-X da Banca',
});

export default function BankAnalysisLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
