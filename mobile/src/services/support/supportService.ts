import { ENDPOINTS } from "@/api/endpoints";
import { apiClient } from "@/api/client";
import { assertApiSuccess, readApiData } from "@/api/response";

export type CreateSupportRequestInput = {
  subject: string;
  details: string;
};

export type CreateSupportRequestResult = {
  message: string;
};

/** Sends authenticated support requests through the same feedback thread API as web. */
export const supportService = {
  async createSupportRequest(input: CreateSupportRequestInput): Promise<CreateSupportRequestResult> {
    const response = await apiClient.post<any>(ENDPOINTS.feedback.create, {
      type: "support",
      reason: input.subject,
      details: input.details,
      gamification_event: "support_feedback_submitted",
      notification_event: "support_opened",
    });
    const envelope = assertApiSuccess(response, "Não foi possível enviar sua solicitação.");
    const payload = readApiData<any>(response, {});

    return {
      message: String(payload?.message || envelope.message || "Atendimento aberto com sucesso."),
    };
  },
};

export default supportService;
