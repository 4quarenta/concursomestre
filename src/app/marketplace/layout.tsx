import type { ReactNode } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';
import { fetchPublicMaterialDirectory, toMarketplaceMaterial } from '../materiais/materialServerData';
import { buildBreadcrumbList, buildStructuredDataGraph } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Marketplace',
  description: 'Encontre materiais, PDFs, resumos e simulados para concursos no marketplace do ConcursoMestre.',
  path: '/marketplace',
});

export default async function MarketplaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  const initialMaterials = await fetchPublicMaterialDirectory({}, 'marketplace')
    .then((directory) => directory.items.map(toMarketplaceMaterial))
    .catch(() => []);
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Marketplace', path: '/marketplace' }];
  return (
    <MarketplaceProvider initialMaterials={initialMaterials}>
      <StructuredData value={buildStructuredDataGraph([buildBreadcrumbList(breadcrumbs)])} />
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <CanonicalBreadcrumbs items={breadcrumbs} />
      </div>
      {children}
    </MarketplaceProvider>
  );
}
