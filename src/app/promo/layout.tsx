import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Promocoes',
  description: 'Confira campanhas, ofertas e promocoes publicas do ConcursoMestre.',
  path: '/promo',
});

export default function PromoLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
