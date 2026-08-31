import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Entrar',
});

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
