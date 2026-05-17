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

import { apiClient, assertApiSuccess, readApiData, ENDPOINTS } from '@services/api';

export type SupportThread = {
  id: number;
  type: string;
  reason: string;
  details: string;
  status: 'new' | 'read' | 'resolved';
  created_at: string;
  reply_count?: number;
};

export type SupportReply = {
  id: number;
  user_id: string;
  details: string;
  created_at: string;
};

type CreateSupportThreadInput = {
  type: string;
  reason: string;
  details: string;
  parent_id?: number;
};

export type CreatedSupportThreadResult = {
  id: number;
  type: string;
  parent_id: number | null;
};

type SupportRecord = Record<string, unknown>;

type SupportPayload = SupportRecord & {
  feedback?: SupportThread[] | SupportRecord;
  replies?: SupportReply[];
  thread?: SupportRecord;
  data?: SupportRecord;
};

const asSupportRecord = (value: unknown): SupportRecord => (
  value && typeof value === 'object' ? value as SupportRecord : {}
);

const readCreatedThreadId = (payload: unknown) => {
  const record = asSupportRecord(payload);
  const feedback = asSupportRecord(record.feedback);
  const thread = asSupportRecord(record.thread);
  const data = asSupportRecord(record.data);

  return Number(
    record.id
    || record.feedback_id
    || record.thread_id
    || record.insert_id
    || feedback.id
    || thread.id
    || data.id
    || 0,
  );
};

/**
 * Centraliza o fluxo da central de suporte/feedback do usuario.
 * Essa camada e consumida pela pagina publica de suporte e pelo historico de conversas.
 *
 * @since 1.0.0
 */
export const supportService = {
  /**
   * Lista os chamados do usuario autenticado.
   *
   * @since 1.0.0
   */
  async listThreads(): Promise<SupportThread[]> {
    const response = await apiClient.get(ENDPOINTS.feedback.list) as unknown;
    const payload = readApiData<SupportThread[] | SupportPayload>(response, {});
    const responsePayload = asSupportRecord(response) as SupportPayload;

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.feedback)) {
      return payload.feedback;
    }

    if (Array.isArray(responsePayload.feedback)) {
      return responsePayload.feedback;
    }

    return [];
  },

  /**
   * Carrega a conversa de um chamado especifico.
   *
   * @since 1.0.0
   */
  async listReplies(threadId: number): Promise<SupportReply[]> {
    const response = await apiClient.get(`${ENDPOINTS.feedback.list}?id=${threadId}`) as unknown;
    const payload = readApiData<SupportPayload>(response, {});
    const responsePayload = asSupportRecord(response) as SupportPayload;

    if (Array.isArray(payload?.replies)) {
      return payload.replies;
    }

    if (Array.isArray(responsePayload.replies)) {
      return responsePayload.replies;
    }

    return [];
  },

  /**
   * Abre um novo chamado/sugestao para o suporte.
   * Retorna o payload persistido para a UI materializar a thread sem depender do refresh imediato.
   *
   * @since 1.0.0
   */
  async createThread(input: CreateSupportThreadInput): Promise<CreatedSupportThreadResult> {
    const response = await apiClient.post(ENDPOINTS.feedback.create, input) as unknown;
    assertApiSuccess(response, 'Nao foi possivel enviar a solicitacao.');

    const payload = readApiData<SupportPayload>(response, {});

    return {
      id: readCreatedThreadId(payload),
      type: String(payload?.type || input.type),
      parent_id: payload?.parent_id === null || payload?.parent_id === undefined
        ? null
        : Number(payload.parent_id || 0),
    };
  },

  /**
   * Responde uma thread existente da central de suporte.
   * O retorno ajuda a auditar que a resposta foi persistida no backend oficial.
   *
   * @since 1.0.0
   */
  async replyToThread(parentId: number, type: string, details: string): Promise<CreatedSupportThreadResult> {
    const response = await apiClient.post(ENDPOINTS.feedback.create, {
      parent_id: parentId,
      type,
      reason: 'Resposta do usuario',
      details,
    }) as unknown;

    assertApiSuccess(response, 'Nao foi possivel enviar a solicitacao.');

    const payload = readApiData<SupportPayload>(response, {});

    return {
      id: readCreatedThreadId(payload),
      type: String(payload?.type || type),
      parent_id: payload?.parent_id === null || payload?.parent_id === undefined
        ? null
        : Number(payload.parent_id || parentId),
    };
  },
};

export default supportService;
