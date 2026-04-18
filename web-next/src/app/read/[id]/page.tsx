import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

export default async function ReadBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { id } = await params;
  redirect(buildLegacyUrl(`/read/${id}`, await searchParams));
}
