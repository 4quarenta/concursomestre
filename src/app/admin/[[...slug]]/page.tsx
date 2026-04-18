import type { Metadata } from 'next';
import AdminPlatformClient from '@/components/admin/AdminPlatformClient';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import { readFirstSearchParam, type RouteSearchParams } from '@/lib/searchParams';
import { resolveAdminRoute } from '@/services/admin';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Admin | ConcursoMestre',
  description: 'Painel administrativo operacional da plataforma.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<RouteSearchParams>;
}) {
  const [{ slug = [] }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const rawSearchSection = readFirstSearchParam(resolvedSearchParams.section);
  const route = resolveAdminRoute(slug[0] || rawSearchSection, slug[1] || rawSearchSection);
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return <AdminPlatformClient initialRoute={route} initialSettings={settings} />;
}
