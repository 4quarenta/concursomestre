import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Confirmar email',
});

export default function ConfirmEmailLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
