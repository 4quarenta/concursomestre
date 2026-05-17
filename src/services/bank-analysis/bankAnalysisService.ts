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
  count?: number;
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

type BankAnalysisApiPayload = Record<string, unknown>;

export type BankPatternInsightsPayload = unknown;

const asPayload = (value: unknown): BankAnalysisApiPayload => (
  value && typeof value === 'object' ? value as BankAnalysisApiPayload : {}
);

const normalizeChartDatum = (item: unknown): XrayChartDatum => {
  const payload = asPayload(item);
  return {
    name: String(payload.name || 'Sem nome'),
    value: Number(payload.value || 0),
  };
};

const normalizeBreakdownDatum = (item: unknown): XrayBreakdownDatum => {
  const payload = asPayload(item);
  return {
    subject: String(payload.subject || 'Sem materia'),
    total: Number(payload.total || 0),
    percent: Number(payload.percent || 0),
    topics: Array.isArray(payload.topics)
      ? payload.topics.map((topic) => {
          const topicPayload = asPayload(topic);
          const normalizedTopic: XrayTopicDatum = {
            topic: String(topicPayload.topic || 'Sem assunto'),
            percent: Number(topicPayload.percent || 0),
          };

          if (topicPayload.count !== undefined && topicPayload.count !== null) {
            normalizedTopic.count = Number(topicPayload.count || 0);
          }

          return normalizedTopic;
        })
      : [],
  };
};

const normalizeExamDatum = (item: unknown, index: number) => {
  const payload = asPayload(item);
  const id = typeof payload.id === 'string' || typeof payload.id === 'number'
    ? payload.id
    : `exam-${index}`;
  const year = typeof payload.year === 'string' || typeof payload.year === 'number'
    ? payload.year
    : '-';
  return {
    id,
    year,
    name: String(payload.name || 'Prova sem identificacao'),
  };
};

const normalizeXrayPayload = (payload: unknown): BankXrayPayload => {
  const data = asPayload(payload);
  return {
    total: Number(data.total || 0),
    textStyle: String(data.textStyle || 'Objetiva e Direta'),
    contextUsage: Number(data.contextUsage || 0),
    difficultyData: Array.isArray(data.difficultyData)
      ? data.difficultyData.map(normalizeChartDatum)
      : [],
    subjectData: Array.isArray(data.subjectData)
      ? data.subjectData.map(normalizeChartDatum)
      : [],
    detailedBreakdown: Array.isArray(data.detailedBreakdown)
      ? data.detailedBreakdown.map(normalizeBreakdownDatum)
      : [],
    examList: Array.isArray(data.examList)
      ? data.examList.map(normalizeExamDatum)
      : [],
    recommendation: String(data.recommendation || ''),
  };
};

const normalizeIntelLinks = (value: unknown): BankIntelLink[] => (
  Array.isArray(value)
    ? value.map((item) => {
        const payload = asPayload(item);
        return {
          text: String(payload.text || ''),
          url: String(payload.url || ''),
        };
      }).filter((item) => item.text || item.url)
    : []
);

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
    ) as unknown;

    const payload = readApiData<BankAnalysisApiPayload>(response, {});

    if (payload.error) {
      return {
        emAndamento: [],
        realizados: [],
      };
    }

    return {
      emAndamento: normalizeIntelLinks(payload.emAndamento),
      realizados: normalizeIntelLinks(payload.realizados),
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
    ) as unknown;

    const payload = readApiData<unknown>(response, {});
    return normalizeXrayPayload(payload);
  },

  /**
   * Mantem compatibilidade com usos antigos do dominio.
   * @since 1.0.0
   */
  async getAnalysis(boardId: string): Promise<BankAnalysis> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.board, {
      params: { boardId },
    }) as unknown;

    const payload = readApiData<{ analysis?: BankAnalysis }>(response, {});
    return payload.analysis || (payload as unknown as BankAnalysis);
  },

  /**
   * Mantem compatibilidade com analiticos de usuário ainda não migrados.
   * @since 1.0.0
   */
  async getUserAnalytics(): Promise<AnalyticsData> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.user) as unknown;
    const payload = readApiData<{ analytics?: AnalyticsData }>(response, {});
    return payload.analytics || (payload as AnalyticsData);
  },

  /**
   * Mantem compatibilidade com os insights de padroes ainda usados
   * indiretamente por partes legadas do app.
   * @since 1.0.0
   */
  async getPatternInsights(boardId: string): Promise<BankPatternInsightsPayload> {
    const response = await apiClient.get(ENDPOINTS.bankAnalysis.insights, {
      params: { boardId },
    }) as unknown;

    const payload = readApiData<{ insights?: BankPatternInsightsPayload }>(response, {});
    return payload.insights ?? payload;
  },
};

export default bankAnalysisService;
