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
import type { UserAnswer, UserNote } from '@types';

/**
 * Reune o progresso persistido do usuario em uma fachada unica e previsivel.
 */
export const userProgressService = {
  /**
   * Carrega as respostas ja persistidas do usuario, aceitando tanto o contrato
   * padrao do `Response::success` quanto arrays crus por compatibilidade.
   */
  async getUserAnswers(userId: string): Promise<UserAnswer[]> {
    const response = await apiClient.get<any>(ENDPOINTS.users.answers, {
      params: { user_id: userId },
    }) as any;

    const payload = readApiData<any>(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Carrega e normaliza as anotacoes de questoes do usuario.
   * Notas de outros tipos ficam fora daqui para manter o contrato do app.
   */
  async getUserQuestionNotes(userId: string): Promise<UserNote[]> {
    const response = await apiClient.get<any>(ENDPOINTS.users.notes, {
      params: { userId },
    }) as any;

    const payload = readApiData<any>(response, {});
    const notes = Array.isArray(payload?.notes)
      ? payload.notes
      : [];

    return notes
      .filter((note: any) => note?.type === 'question')
      .map((note: any) => ({
        id: String(note.id),
        questionId: Number(note.itemId),
        text: note.text,
        timestamp: new Date(note.updatedAt).getTime(),
      }));
  },
};

export default userProgressService;
