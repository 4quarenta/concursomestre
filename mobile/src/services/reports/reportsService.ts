import { ENDPOINTS } from "@/api/endpoints";
import { apiClient } from "@/api/client";
import { assertApiSuccess, readApiData } from "@/api/response";

export type CreateMobileReportInput = {
  reporterId?: string;
  targetType: "question" | "comment";
  targetId: string | number;
  reason: string;
  details?: string;
};

export type CreateMobileReportResult = {
  id: string;
  duplicate?: boolean;
  message?: string;
};

/**
 * Integra o app ao contrato oficial de denúncias da plataforma.
 * O backend resolve o usuário autenticado pelo token e impede falsificação
 * do reporterId enviado pelo cliente.
 */
export const reportsService = {
  async createReport(
    input: CreateMobileReportInput,
  ): Promise<CreateMobileReportResult> {
    const response = await apiClient.post<any>(ENDPOINTS.reports.create, {
      // O backend resolve o denunciante pelo bearer token. Mantemos
      // reporterId na entrada por compatibilidade, mas nunca o enviamos.
      target_type: input.targetType,
      target_id: String(input.targetId),
      reason: input.reason,
      details: input.details || "",
      gamification_event: "report_submitted",
      notification_event: "report_received",
    });

    const envelope = assertApiSuccess(response, "Não foi possível registrar a denúncia.");
    const payload = readApiData<any>(response, {});

    return {
      id: String(payload?.id || envelope.raw?.id || ""),
      duplicate: Boolean(payload?.duplicate ?? envelope.raw?.duplicate),
      message: payload?.message || envelope.message,
    };
  },
};

export default reportsService;
