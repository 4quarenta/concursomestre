import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Campanhas',
  description: 'Acesse campanhas e paginas publicas especiais do ConcursoMestre.',
  path: '/l',
});

export default function LandingCampaignLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
