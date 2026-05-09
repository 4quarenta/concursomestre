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

import { apiClient, ENDPOINTS, readApiData } from '@services/api';
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { UserAnswer, UserNote } from '@types';

type QuestionNoteRecord = {
  id?: number | string;
  itemId?: number | string;
  text?: string;
  type?: string;
  updatedAt?: string;
};

type QuestionNotesResponse = {
  notes?: QuestionNoteRecord[];
};

/**
 * Reune o progresso persistido do usuário em uma fachada unica e previsivel.
 */
export const userProgressService = {
  /**
   * Carrega as respostas já persistidas do usuário, aceitando tanto o contrato
   * padrao do `Response::success` quanto arrays crus por compatibilidade.
   */
  async getUserAnswers(userId: string): Promise<UserAnswer[]> {
    return withRequestCoalescing(buildRequestCacheKey('user-progress:answers', { userId }), async () => {
      const response = await apiClient.get<unknown>(ENDPOINTS.users.answers, {
        params: { user_id: userId },
      });

      const payload = readApiData<unknown>(response, []);
      return Array.isArray(payload) ? payload : [];
    }, 15000);
  },

  /**
   * Carrega e normaliza as anotacoes de questões do usuário.
   * Notas de outros tipos ficam fora daqui para manter o contrato do app.
   */
  async getUserQuestionNotes(userId: string): Promise<UserNote[]> {
    return withRequestCoalescing(buildRequestCacheKey('user-progress:question-notes', { userId }), async () => {
      const response = await apiClient.get<unknown>(ENDPOINTS.users.notes, {
        params: { userId },
      });

      const payload = readApiData<QuestionNotesResponse>(response, {});
      const notes = Array.isArray(payload?.notes)
        ? payload.notes
        : [];

      return notes
        .filter((note) => note?.type === 'question')
        .map((note) => ({
          id: String(note.id),
          questionId: Number(note.itemId),
          text: typeof note.text === 'string' ? note.text : '',
          timestamp: typeof note.updatedAt === 'string' ? new Date(note.updatedAt).getTime() : Date.now(),
        }));
    }, 15000);
  },
};

export default userProgressService;
