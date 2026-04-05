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

import { apiClient, ENDPOINTS, readApiData } from '@services/api';
import type { AnalyticsData, BankAnalysis } from './types';

export type BankIntelLink = {
  text: string;
  url: string;
};

export type BankIntelPayload = {
  emAndamento: BankIntelLink[];
  realizados: BankIntelLink[];
};

export type BankXrayFilters = {
  banca: string;
  cargo?: string;
  ano?: string;
};

/**
 * Fachada oficial do dominio de raio-x. Ela centraliza a leitura dos payloads
 * do backend atual enquanto o frontend vai sendo migrado para contratos mais
 * previsiveis.
 */
export const bankAnalysisService = {
  /**
   * Busca inteligencia publica da banca a partir do site oficial cadastrado.
   */
  async getBankIntel(url: string): Promise<BankIntelPayload> {
    const response = await apiClient.get(
      ENDPOINTS.statistics.bancaInfo,
      { params: { url } },
    ) as any;

    const payload = readApiData<any>(response, {});

    if (payload?.error) {
      return {
        emAndamento: [],
        realizados: [],
      };
    }

    return {
      emAndamento: Array.isArray(payload?.emAndamento) ? payload.emAndamento : [],
      realizados: Array.isArray(payload?.realizados) ? payload.realizados : [],
    };
  },

  /**
   * Busca o raio-x consolidado da banca para os filtros selecionados.
   */
  async getXrayStats(filters: BankXrayFilters): Promise<any> {
    const response = await apiClient.get(
      ENDPOINTS.statistics.xray,
      {
        params: {
          banca: filters.banca,
          cargo: filters.cargo || undefined,
          ano: filters.ano || undefined,
        },
      },
    ) as any;

    return readApiData<any>(response, {});
  },

  /**
   * Mantem compatibilidade com usos antigos do dominio.
   */
  async getAnalysis(boardId: string): Promise<BankAnalysis> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.board, {
      params: { boardId },
    }) as any;

    const payload = readApiData<{ analysis?: BankAnalysis }>(response, {});
    return payload.analysis || (payload as unknown as BankAnalysis);
  },

  /**
   * Mantem compatibilidade com analiticos de usuario ainda nao migrados.
   */
  async getUserAnalytics(): Promise<AnalyticsData> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.user) as any;
    const payload = readApiData<{ analytics?: AnalyticsData }>(response, {});
    return payload.analytics || (payload as AnalyticsData);
  },

  /**
   * Mantem compatibilidade com os insights de padroes ainda usados
   * indiretamente por partes legadas do app.
   */
  async getPatternInsights(boardId: string): Promise<any> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.insights, {
      params: { boardId },
    }) as any;

    const payload = readApiData<{ insights?: any }>(response, {});
    return payload.insights ?? payload;
  },
};

export default bankAnalysisService;
