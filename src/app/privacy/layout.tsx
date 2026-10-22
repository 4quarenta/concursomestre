import type { ReactNode } from 'react';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Politica de privacidade',
  description: 'Consulte como o ConcursoMestre trata dados, privacidade e seguranca dos usuarios da plataforma.',
  path: '/privacy',
});

export default function PrivacyLayout({ children }: Readonly<{ children: ReactNode }>) {
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Política de Privacidade', path: '/privacy' }];
  return <><StructuredData value={buildStructuredDataGraph([buildWebPage({ path: '/privacy', name: 'Política de Privacidade do ConcursoMestre' }), buildBreadcrumbList(breadcrumbs)])} />{children}</>;
}
