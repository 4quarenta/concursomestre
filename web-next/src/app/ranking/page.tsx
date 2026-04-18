import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function RankingBridgePage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  redirect(buildLegacyUrl('/ranking', await searchParams));
}
