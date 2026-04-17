import { notFound, redirect } from 'next/navigation';
import { loadPublicMaterialById } from '@/lib/publicMaterials';
import { buildMaterialPath } from '@/services/seo/slug';

interface MaterialRedirectPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 3600;

export default async function MaterialRedirectPage({ params }: MaterialRedirectPageProps) {
  const { id } = await params;
  const material = await loadPublicMaterialById(id);

  if (!material) {
    notFound();
  }

  redirect(buildMaterialPath(material));
}
