import { notFound, redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

const ALLOWED_STATUSES = new Set(['success', 'failure', 'pending']);

export default async function SubscriptionBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ status: string }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { status } = await params;

  if (!ALLOWED_STATUSES.has(status)) {
    notFound();
  }

  redirect(buildLegacyUrl(`/subscription/${status}`, await searchParams));
}
