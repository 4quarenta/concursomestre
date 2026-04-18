import type { Metadata } from 'next';
import MarketplacePageClient from '@/components/marketplace/MarketplacePageClient';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { Material, SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Marketplace de materiais | ConcursoMestre',
  description: 'Materiais de estudo, PDFs e resumos publicados por colaboradores do ConcursoMestre.',
  alternates: {
    canonical: '/marketplace',
  },
};

export default async function MarketplacePage() {
  const [rawSettings, rawMaterials] = await Promise.all([
    safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
    safeServerFetch<Material[]>('materialsList', []),
  ]);

  return (
    <MarketplacePageClient
      initialMaterials={Array.isArray(rawMaterials) ? rawMaterials : []}
      systemSettings={mergePublicSystemSettings(rawSettings)}
    />
  );
}
