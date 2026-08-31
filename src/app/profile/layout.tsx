import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Perfil',
});

export default function ProfileLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
