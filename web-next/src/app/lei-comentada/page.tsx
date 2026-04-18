import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import FeaturePlaceholderPage from '@/components/shared/FeaturePlaceholderPage';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Lei comentada | ConcursoMestre',
  description: 'Espaco reservado para consulta guiada de legislacao com anotacoes, contexto e navegacao por modulo.',
  alternates: {
    canonical: '/lei-comentada',
  },
};

export default async function AnnotatedLawsPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return (
    <FeaturePlaceholderPage
      title="Lei comentada"
      description="Espaco reservado para consulta guiada de legislacao com anotacoes, contexto e navegacao por modulo."
      icon={FileText}
      isEnabled={settings.features.annotatedLawsEnabled}
      featureLabel="Lei comentada"
      backHref="/"
    />
  );
}
