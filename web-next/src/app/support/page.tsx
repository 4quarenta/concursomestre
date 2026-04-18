import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function SupportBridgePage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  redirect(buildLegacyUrl('/support', await searchParams));
}
