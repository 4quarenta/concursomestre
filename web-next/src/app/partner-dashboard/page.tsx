import type { Metadata } from 'next';
import PartnerDashboardClient from '@/components/partner/PartnerDashboardClient';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Painel de colaborador | ConcursoMestre',
  description: 'Painel para publicar materiais, acompanhar vendas e gerenciar o marketplace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PartnerDashboardPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return <PartnerDashboardClient systemSettings={settings} />;
}
