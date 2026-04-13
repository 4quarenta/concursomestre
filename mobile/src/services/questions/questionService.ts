import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData, readApiErrorMessage } from '@/services/api/response';
import type { Question, UserAnswerInput } from '@/types/questions';

type QuestionPageResult = {
  rows: Question[];
  total: number;
};

/**
 * Fachada oficial mobile para o dominio de questoes.
 * @since v1.0.0
 */
export const questionService = {
  async getQuestionPage(filters?: Record<string, any>): Promise<QuestionPageResult> {
    const response: any = await apiClient.get<any>(ENDPOINTS.questions.list, { params: filters || {} });
    const payload = readApiData<any>(response, {});

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

    const total = Number(payload?.total || response?.total || rows.length || 0);
    return { rows, total };
  },

  async submitUserAnswer(userId: string, answer: UserAnswerInput): Promise<{ success: boolean; message?: string; newXp?: number; newLevel?: number }> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.questions.submit, {
        user_id: userId,
        question_id: answer.questionId,
        selected_option: answer.selectedOptionIndex,
        is_correct: answer.isCorrect,
        time_taken: answer.timeTaken || 0,
      });

      const backendMessage = readApiErrorMessage(response, '');
      if (backendMessage.toLowerCase().includes('nenhum campo editavel foi enviado')) {
        return { success: true, message: 'Resposta ja registrada.' };
      }

      const envelope = assertApiSuccess(response, 'Nao foi possivel salvar a resposta.');
      const payload = readApiData<any>(response, {});

      return {
        success: true,
        message: envelope.message,
        newXp: payload?.new_xp ?? envelope.raw?.new_xp,
        newLevel: payload?.new_level ?? envelope.raw?.new_level,
      };
    } catch (error) {
      return {
        success: false,
        message: readApiErrorMessage(error, 'Nao foi possivel salvar a resposta.'),
      };
    }
  },
};

export default questionService;
