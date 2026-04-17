import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import type { Material } from '@/types';
import { buildAbsoluteUrl, buildMaterialPath, summarizeSeoText } from '@/services/seo/slug';

const normalizeMaterialsList = (payload: unknown): Material[] => {
  if (Array.isArray(payload)) {
    return payload as Material[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;

    if (Array.isArray(objectPayload.rows)) {
      return objectPayload.rows as Material[];
    }
  }

  return [];
};

export const loadPublicMaterialById = async (id: string): Promise<Material | null> => {
  const payload = await safeServerFetch<unknown>('materialsList', []);
  const materials = normalizeMaterialsList(payload);

  return materials.find((material) => String(material.id) === String(id)) || null;
};

export const buildMaterialMetadata = (material: Material): Metadata => {
  const title = `${summarizeSeoText(material.title, 60)} | ConcursoMestre`;
  const description = summarizeSeoText(material.description || material.details || 'Material do marketplace ConcursoMestre.', 160);
  const canonicalPath = buildMaterialPath(material);

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: summarizeSeoText(material.title, 95),
      description: summarizeSeoText(material.description || material.details || 'Material do marketplace ConcursoMestre.', 180),
      images: material.coverUrl ? [{ url: material.coverUrl }] : undefined,
      type: 'article',
      url: buildAbsoluteUrl(canonicalPath),
    },
  };
};
