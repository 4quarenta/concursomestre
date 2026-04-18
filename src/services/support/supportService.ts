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

import { assertApiSuccess, readApiData } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';

const FEEDBACK_ENDPOINTS = {
  list: 'feedback/list.php',
  create: 'feedback/create.php',
} as const;

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

export const supportService = {
  async listThreads(): Promise<SupportThread[]> {
    const response = await requestAuthenticatedApi<any>(FEEDBACK_ENDPOINTS.list, {
      method: 'GET',
    });

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
    const response = await requestAuthenticatedApi<any>(`${FEEDBACK_ENDPOINTS.list}?id=${threadId}`, {
      method: 'GET',
    });

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
    const response = await requestAuthenticatedApi<any>(FEEDBACK_ENDPOINTS.create, {
      method: 'POST',
      body: input,
    });

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
    const response = await requestAuthenticatedApi<any>(FEEDBACK_ENDPOINTS.create, {
      method: 'POST',
      body: {
        parent_id: parentId,
        type,
        reason: 'Resposta do usuario',
        details,
      },
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
