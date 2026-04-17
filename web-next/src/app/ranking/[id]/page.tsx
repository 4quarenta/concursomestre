import { notFound, redirect } from 'next/navigation';
import { loadPublicRankingById } from '@/lib/publicRankings';
import { buildRankingPath } from '@/services/seo/slug';

interface RankingRedirectPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 3600;

export default async function RankingRedirectPage({ params }: RankingRedirectPageProps) {
  const { id } = await params;
  const ranking = await loadPublicRankingById(id);

  if (!ranking) {
    notFound();
  }

  redirect(buildRankingPath(ranking));
}
