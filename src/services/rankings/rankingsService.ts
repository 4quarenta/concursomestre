/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { Ranking, RankingEntry } from '@types';

/**
 * Normaliza cargas de rankings enquanto o backend ainda pode devolver
 * array puro, `{ rankings }`, `{ items }` ou um objeto unico por legado.
 * Isso evita que a UI quebre quando o contrato HTTP vem envelopado.
 * @since 1.0.0
 */
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

/**
 * Fachada oficial do dominio de rankings.
 * Ela conecta a pagina de rankings, o contexto global e o backend oficial sem espalhar detalhes HTTP pela UI.
 * @since v1.0.0
 */
export const rankingsService = {
  /**
   * Lista os rankings disponíveis para exibição na página pública e em contextos administrativos.
   * @since v1.0.0
   */
  async list(): Promise<Ranking[]> {
    const response = await apiClient.get<any>(ENDPOINTS.rankings.list) as any;
    return normalizeRankingsList(readApiData(response, []));
  },

  /**
   * Busca um ranking publico especifico a partir da listagem oficial.
   * @since v1.0.0
   */
  async getById(rankingId: string): Promise<Ranking | null> {
    const rankings = await this.list();
    return rankings.find((ranking) => String(ranking.id) === String(rankingId)) || null;
  },

  /**
   * Cria um novo ranking pelo fluxo administrativo.
   * O retorno preserva o id final para reidratar a lista local sem recarregar a tela inteira.
   * @since v1.0.0
   */
  async create(payload: Ranking): Promise<string> {
    const response = await apiClient.post<any>(ENDPOINTS.rankings.create, payload) as any;
    const raw = assertApiSuccess(response, 'Erro ao criar ranking.').raw;

    return raw?.data?.id ?? raw?.id ?? payload.id;
  },

  /**
   * Envia a participacao de um candidato em um ranking especifico.
   * Esse metodo liga o formulário da pagina pública ao contrato oficial de submissao do backend.
   * @since v1.0.0
   */
  async join(rankingId: string, userId: string, entry: RankingEntry): Promise<string> {
    const response = await apiClient.post<any>(ENDPOINTS.rankings.join, {
      rankingId,
      userId,
      entry,
    }) as any;

    const raw = assertApiSuccess(response, 'Erro ao enviar gabarito.').raw;

    return raw?.data?.id ?? raw?.id ?? entry.id;
  },

  /**
   * Aprova ou rejeita um ranking no fluxo de moderação administrativa.
   * @since v1.0.0
   */
  async moderate(rankingId: string, status: 'approved' | 'rejected'): Promise<void> {
    const response = await apiClient.post<any>(ENDPOINTS.rankings.moderate, { id: rankingId, status }) as any;
    assertApiSuccess(response, 'Erro ao moderar ranking.');
  },

  /**
   * Atualiza um ranking existente no painel administrativo.
   * @since v1.0.0
   */
  async update(payload: Ranking): Promise<void> {
    const response = await apiClient.post<any>(ENDPOINTS.rankings.update, payload) as any;
    assertApiSuccess(response, 'Erro ao atualizar ranking.');
  },

  /**
   * Remove um ranking pelo id no fluxo administrativo.
   * @since v1.0.0
   */
  async remove(rankingId: string): Promise<void> {
    const response = await apiClient.post<any>(ENDPOINTS.rankings.delete, { id: rankingId }) as any;
    assertApiSuccess(response, 'Erro ao excluir ranking.');
  },
};

export default rankingsService;
