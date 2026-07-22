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
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
}

type CreateReportPayload = {
  id?: string | number;
  duplicate?: boolean;
  message?: string;
  xpGain?: string | number | null;
  xp_gain?: string | number | null;
  newXp?: string | number | null;
  new_xp?: string | number | null;
  newLevel?: string | number | null;
  new_level?: string | number | null;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compactReportProgress = (progress: Pick<CreateReportResult, 'xpGain' | 'newXp' | 'newLevel'>) => ({
  ...(progress.xpGain !== undefined ? { xpGain: progress.xpGain } : {}),
  ...(progress.newXp !== undefined ? { newXp: progress.newXp } : {}),
  ...(progress.newLevel !== undefined ? { newLevel: progress.newLevel } : {}),
});

/**
 * Fachada oficial do dominio de denúncias.
 * Centraliza criacao autenticada e leitura administrativa.
 * @since 1.0.0
 */
export const reportsService = {
  /**
   * Registra uma nova denúncia de comentário, material ou questão.
   * Essa funcao alimenta os modais de report espalhados pela plataforma.
   * @since 1.0.0
   */
  async createReport(input: CreateReportInput): Promise<CreateReportResult> {
    const response = await apiClient.post(ENDPOINTS.reports.create, {
      reporter_id: input.reporterId,
      target_type: input.targetType,
      target_id: String(input.targetId),
      reason: input.reason,
      details: input.details,
      evidence_url: input.evidenceUrl,
      gamification_event: 'report_submitted',
      notification_event: 'report_received',
    }) as unknown;

    const envelope = assertApiSuccess(response, 'Falha ao registrar denúncia.');
    const payload = readApiData<CreateReportPayload>(response, {});
    const progress = compactReportProgress({
      xpGain: toOptionalNumber(payload.xpGain ?? payload.xp_gain ?? envelope.raw?.xpGain ?? envelope.raw?.xp_gain),
      newXp: toOptionalNumber(payload.newXp ?? payload.new_xp ?? envelope.raw?.newXp ?? envelope.raw?.new_xp),
      newLevel: toOptionalNumber(payload.newLevel ?? payload.new_level ?? envelope.raw?.newLevel ?? envelope.raw?.new_level),
    });

    return {
      id: String(payload.id ?? envelope.raw?.id ?? ''),
      duplicate: Boolean(payload.duplicate ?? envelope.raw?.duplicate),
      message: payload.message ?? envelope.message,
      ...progress,
    };
  },

  /**
   * Lista denúncias no formato usado pela operação administrativa.
   * @since 1.0.0
   */
  async listReports(): Promise<ErrorReport[]> {
    const response = await apiClient.get(ENDPOINTS.reports.list) as unknown;
    const payload = readApiData<ErrorReport[] | { items?: ErrorReport[] }>(response, []);
    return Array.isArray(payload) ? payload : payload.items || [];
  },
};

export default reportsService;
