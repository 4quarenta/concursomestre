import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Leitor',
});

export default function ReaderLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
