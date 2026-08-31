import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Suporte',
});

export default function SupportLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
