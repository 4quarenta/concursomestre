import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Suporte',
  description: 'Abra uma solicitação, relate problemas, envie sugestões e acompanhe o atendimento do ConcursoMestre.',
  path: '/support',
});

export default function SupportLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
