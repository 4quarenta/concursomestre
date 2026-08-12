import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import { serializeStructuredData } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Termos de uso',
  description: 'Leia os termos de uso que regulam o acesso e a utilizacao da plataforma ConcursoMestre.',
  path: '/terms',
});

export default function TermsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Termos de Uso do ConcursoMestre', url: 'https://concursomestre.com/terms', inLanguage: 'pt-BR' }) }} /></>;
}
