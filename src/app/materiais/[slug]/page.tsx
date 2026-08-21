import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import MaterialDetail from '../MaterialDetail';
import { buildMaterialMetadata } from '../materialMetadata';
import { fetchPublicMaterialDetail, type PublicMaterialDetail } from '../materialServerData';
import { publicRoutes } from '@services/routes/publicRoutes';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };
const load = async (slug: string): Promise<PublicMaterialDetail | null> => {
  const result = await fetchPublicMaterialDetail(slug);
  if (result && 'redirectSlug' in result) permanentRedirect(publicRoutes.materials.detail(result.redirectSlug));
  return result && !('redirectSlug' in result) ? result : null;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; return buildMaterialMetadata(await load(slug)); }
export default async function PublicMaterialPage({ params }: Props) { const { slug } = await params; const item = await load(slug); if (!item) notFound(); return <MaterialDetail item={item}/>; }
