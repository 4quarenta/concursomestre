import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import type { RankingListItem } from '@/types/rankings';

const normalizeRankings = (payload: unknown): RankingListItem[] => {
  if (Array.isArray(payload)) {
    return payload as RankingListItem[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.rankings)) return objectPayload.rankings as RankingListItem[];
    if (Array.isArray(objectPayload.items)) return objectPayload.items as RankingListItem[];
    if (Array.isArray(objectPayload.rows)) return objectPayload.rows as RankingListItem[];
    if (Array.isArray(objectPayload.data)) return objectPayload.data as RankingListItem[];
  }

  return [];
};

/**
 * Servico mobile para listagem de rankings.
 * @since v1.0.0
 */
export const rankingsService = {
  async list(): Promise<RankingListItem[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.rankings.list);
    const payload = readApiData<any>(response, []);
    return normalizeRankings(payload);
  },

  /**
   * Resolve o detalhe publico de um ranking usando a listagem oficial disponivel no backend.
   * @since v1.0.0
   */
  async getById(rankingId: string): Promise<RankingListItem | null> {
    const rankings = await this.list();
    return rankings.find((ranking) => String(ranking.id) === String(rankingId)) || null;
  },
};

export default rankingsService;
