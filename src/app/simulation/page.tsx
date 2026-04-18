import type { Metadata } from 'next';
import SimulationPageClient from '@/components/simulation/SimulationPageClient';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Simulados | ConcursoMestre',
  description: 'Monte simulados cronometrados por materia, banca, ano e dificuldade.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SimulationPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return <SimulationPageClient systemSettings={settings} />;
}
