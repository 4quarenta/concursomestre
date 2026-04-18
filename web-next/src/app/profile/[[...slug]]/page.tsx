import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function ProfileBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { slug = [] } = await params;
  const pathname = ['/profile', ...slug].join('/');

  redirect(buildLegacyUrl(pathname, await searchParams));
}
