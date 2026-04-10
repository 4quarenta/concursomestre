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

type XrayChartDatum = {
  name: string;
  value: number;
};

type XrayTopicDatum = {
  topic: string;
  percent: number;
};

type XrayBreakdownDatum = {
  subject: string;
  total: number;
  percent: number;
  topics: XrayTopicDatum[];
};

export type BankXrayPayload = {
  total: number;
  textStyle: string;
  contextUsage: number;
  difficultyData: XrayChartDatum[];
  subjectData: XrayChartDatum[];
  detailedBreakdown: XrayBreakdownDatum[];
  examList: Array<{ id: string | number; year: string | number; name: string }>;
  recommendation: string;
};

const normalizeChartDatum = (item: any): XrayChartDatum => ({
  name: String(item?.name || 'Sem nome'),
  value: Number(item?.value || 0),
});

const normalizeBreakdownDatum = (item: any): XrayBreakdownDatum => ({
  subject: String(item?.subject || 'Sem materia'),
  total: Number(item?.total || 0),
  percent: Number(item?.percent || 0),
  topics: Array.isArray(item?.topics)
    ? item.topics.map((topic: any) => ({
        topic: String(topic?.topic || 'Sem assunto'),
        percent: Number(topic?.percent || 0),
      }))
    : [],
});

const normalizeExamDatum = (item: any, index: number) => ({
  id: item?.id ?? `exam-${index}`,
  year: item?.year ?? '-',
  name: String(item?.name || 'Prova sem identificacao'),
});

const normalizeXrayPayload = (payload: any): BankXrayPayload => ({
  total: Number(payload?.total || 0),
  textStyle: String(payload?.textStyle || 'Objetiva e Direta'),
  contextUsage: Number(payload?.contextUsage || 0),
  difficultyData: Array.isArray(payload?.difficultyData)
    ? payload.difficultyData.map(normalizeChartDatum)
    : [],
  subjectData: Array.isArray(payload?.subjectData)
    ? payload.subjectData.map(normalizeChartDatum)
    : [],
  detailedBreakdown: Array.isArray(payload?.detailedBreakdown)
    ? payload.detailedBreakdown.map(normalizeBreakdownDatum)
    : [],
  examList: Array.isArray(payload?.examList)
    ? payload.examList.map(normalizeExamDatum)
    : [],
  recommendation: String(payload?.recommendation || ''),
});

/**
 * Fachada oficial do dominio de raio-x. Ela centraliza a leitura dos payloads
 * do backend atual enquanto o frontend vai sendo migrado para contratos mais
 * previsiveis.
 * @since 1.0.0
 */
export const bankAnalysisService = {
  /**
   * Busca inteligencia pública da banca a partir do site oficial cadastrado.
   * @since 1.0.0
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
   * @since 1.0.0
   */
  async getXrayStats(filters: BankXrayFilters): Promise<BankXrayPayload> {
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

    const payload = readApiData<any>(response, {});
    return normalizeXrayPayload(payload);
  },

  /**
   * Mantem compatibilidade com usos antigos do dominio.
   * @since 1.0.0
   */
  async getAnalysis(boardId: string): Promise<BankAnalysis> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.board, {
      params: { boardId },
    }) as any;

    const payload = readApiData<{ analysis?: BankAnalysis }>(response, {});
    return payload.analysis || (payload as unknown as BankAnalysis);
  },

  /**
   * Mantem compatibilidade com analiticos de usuário ainda não migrados.
   * @since 1.0.0
   */
  async getUserAnalytics(): Promise<AnalyticsData> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.user) as any;
    const payload = readApiData<{ analytics?: AnalyticsData }>(response, {});
    return payload.analytics || (payload as AnalyticsData);
  },

  /**
   * Mantem compatibilidade com os insights de padroes ainda usados
   * indiretamente por partes legadas do app.
   * @since 1.0.0
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
