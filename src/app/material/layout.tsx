import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildPublicPageMetadata({
  title: 'Materiais para concursos',
  description: 'Acesse materiais, resumos e PDFs para complementar os estudos em concursos publicos.',
  path: '/material',
});

export default function MaterialLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
