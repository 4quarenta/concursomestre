import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Planos internos',
});

export default function PlansInternalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
