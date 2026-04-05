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
import type { ApiResponse } from '@services/api';
import type { ErrorReport } from '@types';

export interface CreateReportInput {
  reporterId?: string;
  targetType: ErrorReport['targetType'];
  targetId: string | number;
  reason: string;
  details: string;
  evidenceUrl?: string;
}

export interface CreateReportResult {
  id: string;
  duplicate?: boolean;
  message?: string;
}

/**
 * Fachada oficial do dominio de denuncias.
 * Centraliza criacao autenticada e leitura administrativa.
 * @since 1.0.0
 */
export const reportsService = {
  /**
   * Registra uma nova denuncia de comentario, material ou questao.
   * Essa funcao alimenta os modais de report espalhados pela plataforma.
   * @since 1.0.0
   */
  async createReport(input: CreateReportInput): Promise<CreateReportResult> {
    const response = await apiClient.post<any>(ENDPOINTS.reports.create, {
      reporter_id: input.reporterId,
      target_type: input.targetType,
      target_id: String(input.targetId),
      reason: input.reason,
      details: input.details,
      evidence_url: input.evidenceUrl,
    }) as any;

    const envelope = assertApiSuccess(response, 'Falha ao registrar denuncia.');
    const payload = readApiData<Record<string, any>>(response, {});

    return {
      id: String(payload.id ?? envelope.raw?.id ?? ''),
      duplicate: Boolean(payload.duplicate ?? envelope.raw?.duplicate),
      message: payload.message ?? envelope.message,
    };
  },

  /**
   * Lista denuncias no formato usado pela operacao administrativa.
   * @since 1.0.0
   */
  async listReports(): Promise<ErrorReport[]> {
    const response = await apiClient.get<ApiResponse<ErrorReport[]>>(ENDPOINTS.reports.list) as any;
    const payload = readApiData<ErrorReport[]>(response, []);
    return Array.isArray(payload) ? payload : [];
  },
};

export default reportsService;
