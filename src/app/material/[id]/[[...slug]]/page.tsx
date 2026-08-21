import { notFound, permanentRedirect } from 'next/navigation';
import { fetchLegacyMaterialSlug } from '../../../materiais/materialServerData';
import { publicRoutes } from '@services/routes/publicRoutes';

export const revalidate = 300;
export default async function LegacyMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const slug = await fetchLegacyMaterialSlug(id);
  if (!slug) notFound();
  permanentRedirect(publicRoutes.materials.detail(slug));
}
