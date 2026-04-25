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

/**
 * Fachada oficial do domínio de questões.
 * Ela conecta prática, histórico, estatísticas e manutenção administrativa ao backend oficial.
 * @since v1.0.0
 */
export const questionService = {
  /**
   * Carrega uma página de questões com total, preservando compatibilidade com
   * respostas que retornam `rows`, `data.rows` ou arrays crus.
   * @since v1.0.0
   */
  async getQuestionPage(filters?: Record<string, any>): Promise<QuestionListResult> {
    const includeUnpublished = Boolean(filters?.includeUnpublished || filters?.includeDrafts || filters?.admin);
    const response = await apiClient.get<any>(
      ENDPOINTS.questions.list,
      {
        params: includeUnpublished
          ? filters
          : {
            ...filters,
            publication_scope: 'public',
            publish_status: 'published',
          },
      },
    ) as any;

    const payload = readApiData<any>(response, {});
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];
    const normalizedRows = rows.map((row: Question) => withQuestionPublicationAliases(row));
    const visibleRows = includeUnpublished
      ? normalizedRows
      : normalizedRows.filter((row: Question) => isQuestionPubliclyVisible(row));
    const total = payload?.total || response?.total || visibleRows.length;

    return {
      rows: visibleRows,
      total,
    };
  },

  /**
   * Mantem a compatibilidade com consumidores antigos que esperam apenas a
   * lista de questões.
   * @since v1.0.0
   */
  async getQuestions(filters?: Record<string, any>): Promise<Question[]> {
    const result = await this.getQuestionPage(filters);
    return result.rows;
  },

  /**
   * Carrega uma questao publica isolada pelo endpoint oficial de detalhe.
   * @since v1.0.0
   */
  async getQuestionById(questionId: string | number): Promise<Question> {
    const response = await apiClient.get<any>(
      ENDPOINTS.questions.show,
      {
        params: {
          id: String(questionId),
        },
      },
    ) as any;

    return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
  },

  /**
   * Carrega uma questao pelo contrato administrativo de edicao.
   * Esse endpoint preserva campos editoriais, comentarios completos e datas internas.
   * @since v1.0.0
   */
  async getQuestionForAdminEdit(questionId: string | number): Promise<Question> {
    const response = await apiClient.get<any>(
      ENDPOINTS.questions.edit,
      {
        params: {
          id: String(questionId),
        },
      },
    ) as any;

    return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
  },

  /**
   * Persiste a resposta do usuario e devolve o snapshot de progressao
   * necessario para atualizar XP e nivel no frontend.
   * @since v1.0.0
   */
  async submitUserAnswer(userId: string, answer: UserAnswer): Promise<SubmitAnswerResult> {
    const response = await apiClient.post<any>(
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
    ) as any;
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

    const envelope = assertApiSuccess(response, 'Não foi possível salvar a resposta.');
    const payload = readApiData<any>(response, {});
    return {
      success: true,
      message: envelope.message,
      newXp: payload?.new_xp ?? envelope.raw?.new_xp,
      newLevel: payload?.new_level ?? envelope.raw?.new_level,
    };
  },

  /**
   * Carrega o histórico de respostas do usuário para uma questão especifica.
   * Quando o backend estiver em modo convidado, ele devolve uma lista vazia.
   * @since v1.0.0
   */
  async getQuestionHistory(questionId: string | number, userId?: string): Promise<UserAnswer[]> {
    const response = await apiClient.get<any>(
      ENDPOINTS.questions.history,
      {
        params: {
          question_id: String(questionId),
          user_id: userId || '',
        },
      },
    ) as any;

    const payload = readApiData<any>(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Carrega as estatisticas agregadas de uma questão para o grafico da UI.
   * @since v1.0.0
   */
  async getQuestionStats(questionId: string | number): Promise<QuestionStats> {
    const response = await apiClient.get<any>(
      ENDPOINTS.questions.stats,
      {
        params: {
          question_id: String(questionId),
        },
      },
    ) as any;

    return readApiData<QuestionStats>(response, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      optionDistribution: {},
    });
  },

  /**
   * Bridge legado para usos antigos do serviço.
   * @since v1.0.0
   */
  async submitAnswer(answer: UserAnswer): Promise<{ success: boolean; message?: string }> {
    try {
      if (!('userId' in answer) || !(answer as any).userId) {
        return { success: false, message: 'User ID obrigatório para salvar resposta.' };
      }

      const result = await this.submitUserAnswer((answer as any).userId, answer);
      return { success: result.success, message: result.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Cria uma unica questão usando o endpoint oficial de persistencia.
   * @since v1.0.0
   */
  async createQuestion(questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.create,
        normalizedQuestion,
      ) as any;

      const envelope = assertApiSuccess<{ question?: Question; id?: string | number }>(response, 'Não foi possível criar a questão.');
      const payload = readApiData<{ question?: Question; id?: string | number }>(response, {});
      return {
        success: true,
        question: payload?.question
          ? withQuestionPublicationAliases(payload.question)
          : { ...normalizedQuestion, id: payload?.id ?? envelope.raw?.id ?? normalizedQuestion.id },
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Cria varias questões preservando o contrato antigo usado pelo app.
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
   * Atualiza uma questão usando o endpoint oficial de update.
   * @since v1.0.0
   */
  async updateQuestion(id: string, questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.update,
        { ...normalizedQuestion, id },
      ) as any;

      assertApiSuccess(response, 'Não foi possível atualizar a questão.');
      return {
        success: true,
        question: { ...normalizedQuestion, id: Number(id) || Number(normalizedQuestion.id) } as Question,
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Exclui uma questão usando o contrato real do backend, que ainda espera
   * o id na query string.
   * @since v1.0.0
   */
  async deleteQuestion(id: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.get<any>(
        ENDPOINTS.questions.delete,
        { params: { id: String(id) } },
      ) as any;

      const envelope = assertApiSuccess(response, 'Não foi possível excluir a questão.');
      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Alterna o estado salvo de uma questão para o usuário atual.
   * @since v1.0.0
   */
  async toggleSavedQuestion(userId: string, questionId: string | number): Promise<{ success: boolean; isSaved?: boolean; message?: string }> {
    try {
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.toggleSave,
        {
          user_id: userId,
          question_id: questionId,
        },
      ) as any;

      const envelope = assertApiSuccess<{ isSaved?: boolean }>(response, 'Não foi possível atualizar os salvos.');
      const payload = readApiData<{ isSaved?: boolean }>(response, {});
      return {
        success: true,
        isSaved: payload?.isSaved ?? envelope.raw?.isSaved,
        message: envelope.message,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Limpa o progresso de respostas do usuário atual.
   * @since v1.0.0
   */
  async resetAnswers(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.resetAnswers,
        { user_id: userId },
      ) as any;

      const envelope = assertApiSuccess(response, 'Não foi possível limpar as respostas.');

      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },
};

export default questionService;
