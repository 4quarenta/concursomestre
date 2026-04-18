import type { Metadata } from 'next';
import { Layers } from 'lucide-react';
import FeaturePlaceholderPage from '@/components/shared/FeaturePlaceholderPage';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Flashcards | ConcursoMestre',
  description: 'Espaco reservado para revisao ativa com cartas, repeticao espacada e trilhas de memorizacao.',
  alternates: {
    canonical: '/flashcards',
  },
};

export default async function FlashcardsPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return (
    <FeaturePlaceholderPage
      title="Flashcards"
      description="Espaco reservado para revisao ativa com cartas, repeticao espacada e trilhas de memorizacao."
      icon={Layers}
      isEnabled={settings.features.flashcardsEnabled}
      featureLabel="Flashcards"
      backHref="/"
    />
  );
}
