import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';
import { fetchPublicMaterialDirectory, toMarketplaceMaterial } from '../materiais/materialServerData';

export const metadata = buildPublicPageMetadata({
  title: 'Marketplace',
  description: 'Encontre materiais, PDFs, resumos e simulados para concursos no marketplace do ConcursoMestre.',
  path: '/marketplace',
});

export default async function MarketplaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  const initialMaterials = await fetchPublicMaterialDirectory({}, 'marketplace')
    .then((directory) => directory.items.map(toMarketplaceMaterial))
    .catch(() => []);
  return (
    <MarketplaceProvider initialMaterials={initialMaterials}>
      {children}
    </MarketplaceProvider>
  );
}
