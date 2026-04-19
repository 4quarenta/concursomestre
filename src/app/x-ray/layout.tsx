import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Raio-X',
});

export default function XRayLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
