import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import XRayPageClient from '@/components/xray/XRayPageClient';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Raio-X da banca | ConcursoMestre',
  description: 'Analise incidencias, padroes e prioridades de estudo por banca, cargo e periodo.',
  alternates: {
    canonical: '/x-ray',
  },
};

export default async function XRayPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return <XRayPageClient systemSettings={settings} />;
}
