import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Termos de adesao',
  description: 'Consulte os termos de adesao aplicaveis aos planos e assinaturas do ConcursoMestre.',
  path: '/checkout/termos-de-adesao',
});

export default function CheckoutAdhesionTermsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
