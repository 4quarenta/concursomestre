import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import type { Ranking } from '@/types';
import { buildAbsoluteUrl, buildRankingPath, summarizeSeoText } from '@/services/seo/slug';

const normalizeRankingsList = (payload: unknown): Ranking[] => {
  if (Array.isArray(payload)) {
    return payload as Ranking[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;

    if (Array.isArray(objectPayload.rankings)) {
      return objectPayload.rankings as Ranking[];
    }

    if (Array.isArray(objectPayload.items)) {
      return objectPayload.items as Ranking[];
    }
  }

  return [];
};

export const loadPublicRankingById = async (id: string): Promise<Ranking | null> => {
  const payload = await safeServerFetch<unknown>('rankingsList', []);
  const rankings = normalizeRankingsList(payload);

  return rankings.find((ranking) => String(ranking.id) === String(id)) || null;
};

export const buildRankingMetadata = (ranking: Ranking): Metadata => {
  const titleSource = `${ranking.name} ${ranking.institution}`.trim();
  const title = `${summarizeSeoText(titleSource, 60)} | ConcursoMestre`;
  const description = summarizeSeoText(
    `Ranking ${ranking.name} da instituicao ${ranking.institution} com ${ranking.totalQuestions} questoes e ${ranking.entries?.length || 0} participacoes.`,
    160,
  );
  const canonicalPath = buildRankingPath(ranking);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: summarizeSeoText(`${ranking.name} | ${ranking.institution}`, 95),
      description: summarizeSeoText(`Veja colocacao, participacoes e dados do ranking ${ranking.name}.`, 180),
      type: 'article',
      url: buildAbsoluteUrl(canonicalPath),
    },
  };
};
