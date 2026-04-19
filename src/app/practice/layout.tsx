import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Pratica',
});

export default function PracticeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
