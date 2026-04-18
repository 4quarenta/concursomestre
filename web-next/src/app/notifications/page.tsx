import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function NotificationsBridgePage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  redirect(buildLegacyUrl('/notifications', await searchParams));
}
