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

  /** Compatibilidade do contrato legado; novas telas devem usar getQuestionPage. */
  async getAllQuestions(pageSize = 200): Promise<Question[]> {
    const boundedPageSize = Math.max(1, Math.min(50, pageSize));
    const result = await this.getQuestionPage({ page: 1, limit: boundedPageSize });
    return result.rows;
  },

  async submitUserAnswer(userId: string, answer: UserAnswerInput): Promise<QuestionAnswerResult> {
    try {
      const selectedAlternativeId = answer.selectedAlternativeId;
      if (selectedAlternativeId === undefined || selectedAlternativeId === null || selectedAlternativeId === '') {
        return { success: false, message: 'Alternativa selecionada invalida.' };
      }
      const idempotencyKey = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `mobile-answer-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      const response: any = await apiClient.post<any>(ENDPOINTS.questions.submit, {
        questionId: answer.questionId,
        selectedAlternativeId,
        idempotencyKey,
        timeTaken: answer.timeTaken || 0,
      });

      const backendMessage = readApiErrorMessage(response, '');
      if (backendMessage.toLowerCase().includes('nenhum campo editavel foi enviado')) {
        return { success: true, message: 'Resposta ja registrada.' };
      }

      const envelope = assertApiSuccess(response, 'Nao foi possivel salvar a resposta.');
      const payload = readApiData<any>(response, {});
      const evaluation = payload?.answer || payload?.evaluation || {};

      return {
        success: true,
        message: envelope.message,
        newXp: payload?.new_xp ?? payload?.newXp ?? envelope.raw?.new_xp,
        newLevel: payload?.new_level ?? payload?.newLevel ?? envelope.raw?.new_level,
        isCorrect:
          payload?.isCorrect ??
          payload?.is_correct ??
          evaluation?.isCorrect ??
          evaluation?.is_correct,
        correctOptionIndex:
          payload?.correctOptionIndex ??
          payload?.correct_option_index ??
          evaluation?.correctOptionIndex ??
          evaluation?.correct_option_index,
      };
    } catch (error) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel salvar a resposta.') };
    }
  },

  async toggleSavedQuestion(_userId: string, questionId: string | number): Promise<{ success: boolean; isSaved?: boolean; message?: string }> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.questions.toggleSave, {
        // O backend resolve o escopo pelo bearer token. O argumento legado é
        // mantido apenas para compatibilidade com os chamadores atuais.
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

  async getQuestionHistory(questionId: string | number): Promise<QuestionHistoryEntry[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.questions.history, {
      // O backend resolve o usuario pelo bearer token. Nao envie user_id do
      // cliente: isso evita divergencia de identidade e o erro legado
      // "User ID is required" quando o perfil ainda esta sendo hidratado.
      params: { question_id: String(questionId) },
    });

    const payload = readApiData<any>(response, []);
    return Array.isArray(payload) ? payload : [];
  },
};

export default questionService;
