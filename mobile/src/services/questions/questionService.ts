import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData, readApiErrorMessage } from '@/services/api/response';
import type {
  Question,
  QuestionAnswerResult,
  QuestionHistoryEntry,
  QuestionListFilters,
  QuestionPageResult,
  QuestionStats,
  UserAnswerInput,
} from '@/types/questions';

type QuestionPageRequest = QuestionListFilters & {
  page?: number;
  limit?: number;
};

const normalizeListParams = (filters: QuestionPageRequest = {}): Record<string, unknown> => {
  const params: Record<string, unknown> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) {
      return;
    }

    const apiKey = key === 'examMode' ? 'exam_mode' : key;
    params[apiKey] = Array.isArray(value) ? value.join(',') : value;
  });

  return params;
};

/**
 * Fachada oficial mobile para o dominio de questoes.
 * @since v1.0.0
 */
export const questionService = {
  async getQuestionPage(filters: QuestionPageRequest = {}): Promise<QuestionPageResult> {
    const response: any = await apiClient.get<any>(ENDPOINTS.questions.list, {
      params: normalizeListParams(filters),
    });
    const payload = readApiData<any>(response, {});

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

    const total = Number(payload?.total ?? response?.total ?? rows.length ?? 0);
    const page = Math.max(1, Number(payload?.page ?? filters.page ?? 1));
    const perPage = Math.max(1, Number(payload?.perPage ?? payload?.limit ?? filters.limit ?? (rows.length || 1)));
    const pages = Math.max(0, Number(payload?.pages ?? (total > 0 ? Math.ceil(total / perPage) : 0)));

    return { rows, total, page, perPage, pages };
  },

  /** Compatibilidade temporaria da tela legada; novas features nao devem usar. */
  async getAllQuestions(pageSize = 200): Promise<Question[]> {
    const allRows: Question[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;

    while (allRows.length < total) {
      const result = await this.getQuestionPage({ page, limit: pageSize });
      allRows.push(...result.rows);
      total = Number(result.total || allRows.length || 0);

      if (result.rows.length === 0 || result.page >= result.pages || result.rows.length < pageSize) break;
      page += 1;
    }

    return allRows;
  },

  async submitUserAnswer(userId: string, answer: UserAnswerInput): Promise<QuestionAnswerResult> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.questions.submit, {
        user_id: userId,
        question_id: answer.questionId,
        selected_option: answer.selectedOptionIndex,
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
        newXp: payload?.new_xp ?? payload?.newXp ?? envelope.raw?.new_xp,
        newLevel: payload?.new_level ?? payload?.newLevel ?? envelope.raw?.new_level,
        isCorrect: payload?.isCorrect ?? payload?.is_correct,
        correctOptionIndex: payload?.correctOptionIndex ?? payload?.correct_option_index,
      };
    } catch (error) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel salvar a resposta.') };
    }
  },

  async toggleSavedQuestion(userId: string, questionId: string | number): Promise<{ success: boolean; isSaved?: boolean; message?: string }> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.questions.toggleSave, {
        user_id: userId,
        question_id: questionId,
      });

      const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar as questoes salvas.');
      const payload = readApiData<any>(response, {});

      return {
        success: true,
        isSaved: payload?.isSaved ?? envelope.raw?.isSaved,
        message: envelope.message,
      };
    } catch (error) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel atualizar as questoes salvas.') };
    }
  },

  async getQuestionStats(questionId: string | number): Promise<QuestionStats> {
    const response: any = await apiClient.get<any>(ENDPOINTS.questions.stats, {
      params: { question_id: String(questionId) },
    });

    return readApiData<QuestionStats>(response, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      optionDistribution: {},
    });
  },

  async getQuestionHistory(questionId: string | number, userId?: string): Promise<QuestionHistoryEntry[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.questions.history, {
      params: { question_id: String(questionId), user_id: userId || '' },
    });

    const payload = readApiData<any>(response, []);
    return Array.isArray(payload) ? payload : [];
  },
};

export default questionService;
