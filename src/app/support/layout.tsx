import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import { serializeStructuredData } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Suporte',
  description: 'Abra uma solicitação, relate problemas, envie sugestões e acompanhe o atendimento do ConcursoMestre.',
  path: '/support',
});

export default function SupportLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData({ '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Suporte ConcursoMestre', url: 'https://concursomestre.com/support' }) }} /></>;
}
