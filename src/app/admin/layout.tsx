import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Painel admin',
});

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
