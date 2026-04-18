import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import ConcursosCatalogClient from '@/app/concursos/ConcursosCatalogClient';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Concursos | ConcursoMestre',
  description: 'Explore o catalogo inicial de concursos por banca, cargo e periodo dentro da plataforma ConcursoMestre.',
  alternates: {
    canonical: '/concursos',
  },
};

export default async function ConcursosPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return <ConcursosCatalogClient taxonomies={settings.taxonomies || {
    agencies: [],
    organizations: [],
    subjects: [],
    topics: [],
    roles: [],
    careers: [],
    years: [],
    modalities: [],
  }} />;
}
