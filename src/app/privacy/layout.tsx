import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Politica de privacidade',
  description: 'Consulte como o ConcursoMestre trata dados, privacidade e seguranca dos usuarios da plataforma.',
  path: '/privacy',
});

export default function PrivacyLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
