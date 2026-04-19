import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Redefinir senha',
});

export default function ResetPasswordLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
