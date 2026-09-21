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
import { findQuestionFixture, questionFixtures, QUESTION_FIXTURE_MODE } from '@/features/questions/data/questionFixtures';

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
    if (QUESTION_FIXTURE_MODE) {
      const values = (value: unknown): string[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(String).map((item) => item.toLowerCase());
      const keyword = String(filters.keyword || '').trim().toLowerCase();
      const subjects = values(filters.subject);
      const agencies = values(filters.agency);
      const years = values(filters.year);
      const difficulties = values(filters.difficulty);
      const questionIds = values(filters.questionIds);
      const filtered = questionFixtures.filter((question) => {
        const text = `${question.enunciado_clean || question.enunciado || ''} ${(question.assuntos || []).map((item) => item.nome).join(' ')}`.toLowerCase();
        const subjectNames = (question.assuntos || []).filter((item) => item.materia).map((item) => String(item.nome || '').toLowerCase());
        const agencyNames = (question.bancas || []).flatMap((item) => [item.nome, item.sigla]).filter(Boolean).map((item) => String(item).toLowerCase());
        const questionYears = (question.anos || []).map(String);
        const difficulty = Number(question.dificuldade || 0) >= 3 ? 'dificil' : Number(question.dificuldade || 0) === 2 ? 'medio' : 'facil';
        return (!questionIds.length || questionIds.includes(String(question.id).toLowerCase()))
          && (!keyword || text.includes(keyword))
          && (!subjects.length || subjects.some((item) => subjectNames.includes(item) || text.includes(item)))
          && (!agencies.length || agencies.some((item) => agencyNames.includes(item)))
          && (!years.length || years.some((item) => questionYears.includes(item)))
          && (!difficulties.length || difficulties.some((item) => item.includes(difficulty) || (item === 'muito facil' && difficulty === 'facil') || (item === 'muito dificil' && difficulty === 'dificil')));
      });
      const page = Math.max(1, Number(filters.page || 1));
      const perPage = Math.max(1, Number(filters.limit || 20));
      const start = (page - 1) * perPage;
      return { rows: filtered.slice(start, start + perPage), total: filtered.length, page, perPage, pages: Math.ceil(filtered.length / perPage) };
    }
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
    if (QUESTION_FIXTURE_MODE) {
      const question = findQuestionFixture(answer.questionId);
      return question
        ? { success: true, isCorrect: question.correctOptionIndex === answer.selectedOptionIndex, correctOptionIndex: question.correctOptionIndex }
        : { success: false, message: 'Questao de teste nao encontrada.' };
    }
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

  async toggleSavedQuestion(userId: string, questionId: string | number): Promise<{ success: boolean; isSaved?: boolean; message?: string }> {
    if (QUESTION_FIXTURE_MODE) return { success: true, isSaved: true };
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
    if (QUESTION_FIXTURE_MODE) {
      const question = findQuestionFixture(questionId);
      return question?.stats || { totalAttempts: 0, correctCount: 0, wrongCount: 0, optionDistribution: {} };
    }
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
    if (QUESTION_FIXTURE_MODE) return [];
    const response: any = await apiClient.get<any>(ENDPOINTS.questions.history, {
      params: { question_id: String(questionId), user_id: userId || '' },
    });

    const payload = readApiData<any>(response, []);
    return Array.isArray(payload) ? payload : [];
  },
};

export default questionService;
