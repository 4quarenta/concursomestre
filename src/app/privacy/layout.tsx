import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import { serializeStructuredData } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Politica de privacidade',
  description: 'Consulte como o ConcursoMestre trata dados, privacidade e seguranca dos usuarios da plataforma.',
  path: '/privacy',
});

export default function PrivacyLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Politica de Privacidade do ConcursoMestre', url: 'https://concursomestre.com/privacy', inLanguage: 'pt-BR' }) }} /></>;
}
