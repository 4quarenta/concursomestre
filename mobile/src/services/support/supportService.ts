import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type {
  CreatedSupportThreadResult,
  CreateSupportThreadInput,
  SupportReply,
  SupportThread,
} from '@/types/support';

/**
 * Fluxo mobile da central de suporte/feedback.
 * @since v1.0.0
 */
export const supportService = {
  async listThreads(): Promise<SupportThread[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.feedback.list);
    const payload = readApiData<any>(response, {});

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.feedback)) {
      return payload.feedback;
    }

    if (Array.isArray(response?.feedback)) {
      return response.feedback;
    }

    return [];
  },

  async listReplies(threadId: number): Promise<SupportReply[]> {
    const response: any = await apiClient.get<any>(`${ENDPOINTS.feedback.list}?id=${threadId}`);
    const payload = readApiData<any>(response, {});

    if (Array.isArray(payload?.replies)) {
      return payload.replies;
    }

    if (Array.isArray(response?.replies)) {
      return response.replies;
    }

    return [];
  },

  async createThread(input: CreateSupportThreadInput): Promise<CreatedSupportThreadResult> {
    const response: any = await apiClient.post<any>(ENDPOINTS.feedback.create, input);
    assertApiSuccess(response, 'Nao foi possivel enviar a solicitacao.');
    const payload = readApiData<any>(response, {});

    return {
      id: Number(payload?.id || 0),
      type: String(payload?.type || input.type),
      parent_id: payload?.parent_id === null || payload?.parent_id === undefined
        ? null
        : Number(payload.parent_id || 0),
    };
  },

  async replyToThread(parentId: number, type: string, details: string): Promise<CreatedSupportThreadResult> {
    const response: any = await apiClient.post<any>(ENDPOINTS.feedback.create, {
      parent_id: parentId,
      type,
      reason: 'Resposta do usuario',
      details,
    });
    assertApiSuccess(response, 'Nao foi possivel enviar a solicitacao.');
    const payload = readApiData<any>(response, {});

    return {
      id: Number(payload?.id || 0),
      type: String(payload?.type || type),
      parent_id: payload?.parent_id === null || payload?.parent_id === undefined
        ? null
        : Number(payload.parent_id || parentId),
    };
  },
};

export default supportService;
