import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import type {
  BankXrayBreakdownDatum,
  BankXrayChartDatum,
  BankXrayExamDatum,
  BankXrayFilters,
  BankXrayPayload,
} from '@/types/bankAnalysis';

const normalizeChartDatum = (item: any): BankXrayChartDatum => ({
  name: String(item?.name || 'Sem nome'),
  value: Number(item?.value || 0),
});

const normalizeBreakdownDatum = (item: any): BankXrayBreakdownDatum => ({
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

const normalizeExamDatum = (item: any, index: number): BankXrayExamDatum => ({
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

/**
 * Fachada mobile de Raio-X da banca.
 * @since v1.0.0
 */
export const bankAnalysisService = {
  async getXrayStats(filters: BankXrayFilters): Promise<BankXrayPayload> {
    const response: any = await apiClient.get<any>(ENDPOINTS.statistics.xray, {
      params: {
        banca: filters.banca,
        cargo: filters.cargo || undefined,
        ano: filters.ano || undefined,
      },
    });

    const payload = readApiData<any>(response, {});
    return normalizeXrayPayload(payload);
  },
};

export default bankAnalysisService;
