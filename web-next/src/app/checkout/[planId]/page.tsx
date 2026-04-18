import type { Metadata } from 'next';
import CheckoutPlanClient from '@/components/checkout/CheckoutPlanClient';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { Plan, SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Checkout seguro | ConcursoMestre',
  description: 'Finalize sua assinatura do ConcursoMestre com processamento seguro.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const [rawSettings, plans] = await Promise.all([
    safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
    safeServerFetch<Plan[]>('plans/list.php', []),
  ]);

  const settings = mergePublicSystemSettings(rawSettings);
  const plan = Array.isArray(plans)
    ? plans.find((item) => String(item.id) === String(planId)) || null
    : null;

  return (
    <CheckoutPlanClient
      plan={plan}
      planId={planId}
      systemSettings={settings}
    />
  );
}
