import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Duvidas frequentes',
  description: 'Tire duvidas sobre planos, assinatura, reembolso, gamificacao, simulados, marketplace e suporte do ConcursoMestre.',
  path: '/faq',
});

export default function FaqLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
