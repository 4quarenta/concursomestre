import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function AdminBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { slug = [] } = await params;
  const pathname = ['/admin', ...slug].join('/');

  redirect(buildLegacyUrl(pathname, await searchParams));
}
