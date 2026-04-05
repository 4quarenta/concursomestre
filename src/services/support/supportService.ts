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

/**
 * Centraliza o fluxo da central de suporte/feedback do usuario.
 * Essa camada e consumida pela pagina publica de suporte e pelo historico de conversas.
 * @since 1.0.0
 */
export const supportService = {
  /**
   * Lista os chamados do usuario autenticado.
   * @since 1.0.0
   */
  async listThreads(): Promise<SupportThread[]> {
    const response = await apiClient.get(ENDPOINTS.feedback.list) as any;
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

  /**
   * Carrega a conversa de um chamado especifico.
   * @since 1.0.0
   */
  async listReplies(threadId: number): Promise<SupportReply[]> {
    const response = await apiClient.get(`${ENDPOINTS.feedback.list}?id=${threadId}`) as any;
    const payload = readApiData<any>(response, {});

    if (Array.isArray(payload?.replies)) {
      return payload.replies;
    }

    if (Array.isArray(response?.replies)) {
      return response.replies;
    }

    return [];
  },

  /**
   * Abre um novo chamado/sugestao para o suporte.
   * @since 1.0.0
   */
  async createThread(input: CreateSupportThreadInput): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.feedback.create, input) as any;
    assertApiSuccess(response, 'Nao foi possivel enviar a solicitacao.');
  },

  /**
   * Responde uma thread existente da central de suporte.
   * @since 1.0.0
   */
  async replyToThread(parentId: number, type: string, details: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.feedback.create, {
      parent_id: parentId,
      type,
      reason: 'Resposta do usuario',
      details,
    }) as any;

    assertApiSuccess(response, 'Nao foi possivel enviar a solicitacao.');
  },
};

export default supportService;
