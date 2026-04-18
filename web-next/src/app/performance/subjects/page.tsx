import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function PerformanceSubjectsBridgePage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  redirect(buildLegacyUrl('/performance/subjects', await searchParams));
}
