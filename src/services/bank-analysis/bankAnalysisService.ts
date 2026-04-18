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

import { readApiData } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';

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

const XRAY_ENDPOINTS = {
  bankInfo: 'statistics/banca_info.php',
  stats: 'statistics/xray.php',
} as const;

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
  textStyle: String(payload?.textStyle || 'Objetiva e direta'),
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

const buildEndpoint = (endpoint: string, params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${endpoint}?${query}` : endpoint;
};

export const bankAnalysisService = {
  async getBankIntel(url: string): Promise<BankIntelPayload> {
    const response = await requestAuthenticatedApi<any>(
      buildEndpoint(XRAY_ENDPOINTS.bankInfo, { url }),
      {
        method: 'GET',
      },
    );

    const payload = readApiData<any>(response, {});
    if (payload?.error) {
      return { emAndamento: [], realizados: [] };
    }

    return {
      emAndamento: Array.isArray(payload?.emAndamento) ? payload.emAndamento : [],
      realizados: Array.isArray(payload?.realizados) ? payload.realizados : [],
    };
  },

  async getXrayStats(filters: BankXrayFilters): Promise<BankXrayPayload> {
    const response = await requestAuthenticatedApi<any>(
      buildEndpoint(XRAY_ENDPOINTS.stats, {
        banca: filters.banca,
        cargo: filters.cargo,
        ano: filters.ano,
      }),
      {
        method: 'GET',
      },
    );

    const payload = readApiData<any>(response, {});
    return normalizeXrayPayload(payload);
  },
};

export default bankAnalysisService;
