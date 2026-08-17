import { Suspense, type ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildPublicPageMetadata({
  title: 'Marketplace',
  description: 'Encontre materiais, PDFs, resumos e simulados para concursos no marketplace do ConcursoMestre.',
  path: '/marketplace',
});

export default function MarketplaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <MarketplaceProvider>
      <Suspense fallback={null}>{children}</Suspense>
    </MarketplaceProvider>
  );
}
