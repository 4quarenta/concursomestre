import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function CheckoutBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { planId } = await params;
  redirect(buildLegacyUrl(`/checkout/${planId}`, await searchParams));
}
