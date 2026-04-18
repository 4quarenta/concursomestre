import type { Metadata } from 'next';
import ProfilePageClient from '@/components/profile/ProfilePageClient';
import type { RouteSearchParams } from '@/lib/searchParams';

type ProfileTab = 'personal' | 'billing' | 'materials' | 'security' | 'referral';

const validTabs = new Set<ProfileTab>(['personal', 'billing', 'materials', 'security', 'referral']);

const resolveProfileTab = (slug?: string[], searchParams?: RouteSearchParams): ProfileTab => {
  const firstSlug = slug?.[0];
  const rawTab = typeof searchParams?.tab === 'string' ? searchParams.tab : firstSlug;
  const normalized = String(rawTab || '').toLowerCase();

  if (normalized === 'cards' || normalized === 'billing-history') {
    return 'billing';
  }

  return validTabs.has(normalized as ProfileTab)
    ? normalized as ProfileTab
    : 'personal';
};

export const metadata: Metadata = {
  title: 'Perfil | ConcursoMestre',
  description: 'Area autenticada para gerenciar conta, assinatura e materiais.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<RouteSearchParams>;
}) {
  const [{ slug = [] }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return <ProfilePageClient initialTab={resolveProfileTab(slug, resolvedSearchParams)} />;
}
