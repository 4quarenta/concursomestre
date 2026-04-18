import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function ConfirmEmailBridgePage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  redirect(buildLegacyUrl('/confirm-email', await searchParams));
}
