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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData, readApiErrorMessage } from '@services/api';
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { Question, QuestionStats, UserAnswer } from 'types';
import { isQuestionPubliclyVisible, withQuestionPublicationAliases } from './questionPublication';

type QuestionListResult = {
  rows: Question[];
  total: number;
};

type SubmitAnswerResult = {
  success: boolean;
  message?: string;
  newXp?: number;
  newLevel?: number;
};

type QuestionCreateResponse = {
  question?: Question;
  id?: string | number;
};

type ToggleSavedQuestionResponse = {
  isSaved?: boolean;
};

type QuestionFilters = Record<string, string | number | boolean | undefined | null>;

type QuestionPageResponse = {
  rows?: Question[];
  total?: number;
};

type SubmitAnswerApiResponse = {
  new_xp?: number;
  new_level?: number;
};

const getUserAnswerUserId = (answer: UserAnswer): string | null => {
  if (!('userId' in answer)) {
    return null;
  }

  const userId = answer.userId;
  return typeof userId === 'string' && userId.trim() ? userId : null;
};

/**
 * Fachada oficial do dominio de questoes.
 * Ela conecta pratica, historico, estatisticas e manutencao administrativa ao backend oficial.
 * @since v1.0.0
 */
export const questionService = {
  /**
   * Carrega uma pagina de questoes com total.
   * @since v1.0.0
   */
  async getQuestionPage(filters?: QuestionFilters): Promise<QuestionListResult> {
    const includeUnpublished = Boolean(filters?.includeUnpublished || filters?.includeDrafts || filters?.admin);
    const params = includeUnpublished
      ? filters
      : {
        ...filters,
        publication_scope: 'public',
        publish_status: 'published',
      };

    return withRequestCoalescing(buildRequestCacheKey('questions:list', params), async () => {
      const response = await apiClient.get<QuestionPageResponse | Question[]>(
        ENDPOINTS.questions.list,
        {
          params,
        },
      );

      const payload = readApiData<QuestionPageResponse | Question[]>(response, {});
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.rows)
          ? payload.rows
          : [];
      const normalizedRows = rows.map((row) => withQuestionPublicationAliases(row));
      const visibleRows = includeUnpublished
        ? normalizedRows
        : normalizedRows.filter((row) => isQuestionPubliclyVisible(row));
      const total = Array.isArray(payload) ? visibleRows.length : Number(payload.total || visibleRows.length);

      return {
        rows: visibleRows,
        total,
      };
    }, 2500);
  },

  /**
   * Mantem a compatibilidade com consumidores antigos que esperam apenas a lista.
   * @since v1.0.0
   */
  async getQuestions(filters?: QuestionFilters): Promise<Question[]> {
    const result = await this.getQuestionPage(filters);
    return result.rows;
  },

  /**
   * Carrega uma questao publica isolada.
   * @since v1.0.0
   */
  async getQuestionById(questionId: string | number): Promise<Question> {
    const response = await apiClient.get<Question>(
      ENDPOINTS.questions.show,
      {
        params: {
          id: String(questionId),
        },
      },
    );

    return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
  },

  /**
   * Carrega uma questao pelo contrato administrativo de edicao.
   * @since v1.0.0
   */
  async getQuestionForAdminEdit(questionId: string | number): Promise<Question> {
    const normalizedQuestionId = String(questionId);
    return withRequestCoalescing(
      buildRequestCacheKey('questions:admin-edit', { id: normalizedQuestionId }),
      async () => {
        const response = await apiClient.get<Question>(
          ENDPOINTS.questions.edit,
          {
            params: {
              id: normalizedQuestionId,
            },
          },
        );

        return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
      },
      15_000,
    );
  },

  /**
   * Persiste a resposta do usuario e devolve o snapshot de progressao.
   * @since v1.0.0
   */
  async submitUserAnswer(userId: string, answer: UserAnswer): Promise<SubmitAnswerResult> {
    const response = await apiClient.post<SubmitAnswerApiResponse>(
      ENDPOINTS.questions.submit,
      {
        user_id: userId,
        question_id: answer.questionId,
        selected_option: answer.selectedOptionIndex,
        is_correct: answer.isCorrect,
        time_taken: answer.timeTaken || 0,
        simulation_id: (() => {
          const rawSimulationId = answer.simulationId;
          if (typeof rawSimulationId === 'number') return rawSimulationId;
          if (typeof rawSimulationId === 'string' && /^\d+$/.test(rawSimulationId.trim())) {
            return Number(rawSimulationId.trim());
          }
          return null;
        })(),
      },
    );
    const backendErrorMessage = readApiErrorMessage(response, '');
    if (
      typeof backendErrorMessage === 'string'
      && backendErrorMessage.toLowerCase().includes('nenhum campo editavel foi enviado')
    ) {
      return {
        success: true,
        message: 'Resposta ja registrada.',
      };
    }

    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar a resposta.');
    const payload = readApiData<SubmitAnswerApiResponse>(response, {});
    return {
      success: true,
      message: envelope.message,
      newXp: payload.new_xp ?? (typeof envelope.raw.new_xp === 'number' ? envelope.raw.new_xp : undefined),
      newLevel: payload.new_level ?? (typeof envelope.raw.new_level === 'number' ? envelope.raw.new_level : undefined),
    };
  },

  /**
   * Carrega o historico de respostas do usuario para uma questao especifica.
   * @since v1.0.0
   */
  async getQuestionHistory(questionId: string | number, userId?: string): Promise<UserAnswer[]> {
    const response = await apiClient.get<UserAnswer[]>(
      ENDPOINTS.questions.history,
      {
        params: {
          question_id: String(questionId),
          user_id: userId || '',
        },
      },
    );

    const payload = readApiData<UserAnswer[]>(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Carrega as estatisticas agregadas de uma questao.
   * @since v1.0.0
   */
  async getQuestionStats(questionId: string | number): Promise<QuestionStats> {
    const response = await apiClient.get<QuestionStats>(
      ENDPOINTS.questions.stats,
      {
        params: {
          question_id: String(questionId),
        },
      },
    );

    return readApiData<QuestionStats>(response, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      optionDistribution: {},
    });
  },

  /**
   * Bridge legado para usos antigos do servico.
   * @since v1.0.0
   */
  async submitAnswer(answer: UserAnswer): Promise<{ success: boolean; message?: string }> {
    try {
      const userId = getUserAnswerUserId(answer);
      if (!userId) {
        return { success: false, message: 'User ID obrigatorio para salvar resposta.' };
      }

      const result = await this.submitUserAnswer(userId, answer);
      return { success: result.success, message: result.message };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel salvar a resposta.') };
    }
  },

  /**
   * Cria uma unica questao usando o endpoint oficial de persistencia.
   * @since v1.0.0
   */
  async createQuestion(questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const response = await apiClient.post<QuestionCreateResponse>(
        ENDPOINTS.questions.create,
        normalizedQuestion,
      );

      const envelope = assertApiSuccess<QuestionCreateResponse>(response, 'Nao foi possivel criar a questao.');
      const payload = readApiData<QuestionCreateResponse>(response, {});
      const resolvedId = Number(payload.id ?? envelope.raw.id ?? normalizedQuestion.id) || Number(normalizedQuestion.id);

      return {
        success: true,
        question: payload.question
          ? withQuestionPublicationAliases(payload.question)
          : { ...normalizedQuestion, id: resolvedId },
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Cria varias questoes preservando o contrato antigo usado pelo app.
   * @since v1.0.0
   */
  async createQuestions(questions: Question[]): Promise<{ success: boolean; count?: number; created?: Question[] }> {
    try {
      let successCount = 0;
      const created: Question[] = [];

      for (const question of questions) {
        const result = await this.createQuestion(question);
        if (result.success && result.question) {
          successCount += 1;
          created.push(result.question);
        }
      }

      return { success: true, count: successCount, created };
    } catch {
      return { success: false };
    }
  },

  /**
   * Atualiza uma questao usando o endpoint oficial de update.
   * @since v1.0.0
   */
  async updateQuestion(id: string, questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const response = await apiClient.post<Question>(
        ENDPOINTS.questions.update,
        { ...normalizedQuestion, id },
      );

      assertApiSuccess(response, 'Nao foi possivel atualizar a questao.');
      return {
        success: true,
        question: { ...normalizedQuestion, id: Number(id) || Number(normalizedQuestion.id) } as Question,
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Exclui uma questao usando o contrato real do backend.
   * @since v1.0.0
   */
  async deleteQuestion(id: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.get(
        ENDPOINTS.questions.delete,
        { params: { id: String(id) } },
      );

      const envelope = assertApiSuccess(response, 'Nao foi possivel excluir a questao.');
      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel excluir a questao.') };
    }
  },

  /**
   * Alterna o estado salvo de uma questao para o usuario atual.
   * @since v1.0.0
   */
  async toggleSavedQuestion(userId: string, questionId: string | number): Promise<{ success: boolean; isSaved?: boolean; message?: string }> {
    try {
      const response = await apiClient.post<ToggleSavedQuestionResponse>(
        ENDPOINTS.questions.toggleSave,
        {
          user_id: userId,
          question_id: questionId,
        },
      );

      const envelope = assertApiSuccess<ToggleSavedQuestionResponse>(response, 'Nao foi possivel atualizar os salvos.');
      const payload = readApiData<ToggleSavedQuestionResponse>(response, {});
      const resolvedSaved = payload.isSaved ?? envelope.raw.isSaved;

      return {
        success: true,
        isSaved: typeof resolvedSaved === 'boolean' ? resolvedSaved : undefined,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel atualizar os salvos.') };
    }
  },

  /**
   * Limpa o progresso de respostas do usuario atual.
   * @since v1.0.0
   */
  async resetAnswers(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post(
        ENDPOINTS.questions.resetAnswers,
        { user_id: userId },
      );

      const envelope = assertApiSuccess(response, 'Nao foi possivel limpar as respostas.');

      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel limpar as respostas.') };
    }
  },
};

export default questionService;
