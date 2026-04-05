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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { Question, QuestionStats, UserAnswer } from 'types';

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
 * Fachada oficial do dominio de questoes.
 * Ela conecta pratica, historico, estatisticas e manutencao administrativa ao backend oficial.
 * @since v1.0.0
 */
export const questionService = {
  /**
   * Carrega uma pagina de questoes com total, preservando compatibilidade com
   * respostas que retornam `rows`, `data.rows` ou arrays crus.
   * @since v1.0.0
   */
  async getQuestionPage(filters?: Record<string, any>): Promise<QuestionListResult> {
    const response = await apiClient.get<any>(
      ENDPOINTS.questions.list,
      { params: filters },
    ) as any;

    const payload = readApiData<any>(response, {});
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];
    const total = payload?.total || response?.total || rows.length;

    return {
      rows,
      total,
    };
  },

  /**
   * Mantem a compatibilidade com consumidores antigos que esperam apenas a
   * lista de questoes.
   * @since v1.0.0
   */
  async getQuestions(filters?: Record<string, any>): Promise<Question[]> {
    const result = await this.getQuestionPage(filters);
    return result.rows;
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
        simulation_id: answer.simulationId || null,
      },
    ) as any;

    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar a resposta.');
    const payload = readApiData<any>(response, {});
    return {
      success: true,
      message: envelope.message,
      newXp: payload?.new_xp ?? envelope.raw?.new_xp,
      newLevel: payload?.new_level ?? envelope.raw?.new_level,
    };
  },

  /**
   * Carrega o historico de respostas do usuario para uma questao especifica.
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
   * Carrega as estatisticas agregadas de uma questao para o grafico da UI.
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
   * Bridge legado para usos antigos do servico.
   * @since v1.0.0
   */
  async submitAnswer(answer: UserAnswer): Promise<{ success: boolean; message?: string }> {
    try {
      if (!('userId' in answer) || !(answer as any).userId) {
        return { success: false, message: 'User ID obrigatorio para salvar resposta.' };
      }

      const result = await this.submitUserAnswer((answer as any).userId, answer);
      return { success: result.success, message: result.message };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Cria uma unica questao usando o endpoint oficial de persistencia.
   * @since v1.0.0
   */
  async createQuestion(questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.create,
        questionData,
      ) as any;

      const envelope = assertApiSuccess<{ question?: Question; id?: string | number }>(response, 'Nao foi possivel criar a questao.');
      const payload = readApiData<{ question?: Question; id?: string | number }>(response, {});
      return {
        success: true,
        question: payload?.question ?? { ...questionData, id: payload?.id ?? envelope.raw?.id ?? questionData.id },
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
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.update,
        { ...questionData, id },
      ) as any;

      assertApiSuccess(response, 'Nao foi possivel atualizar a questao.');
      return {
        success: true,
        question: { ...questionData, id: Number(id) || id },
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Exclui uma questao usando o contrato real do backend, que ainda espera
   * o id na query string.
   * @since v1.0.0
   */
  async deleteQuestion(id: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.get<any>(
        ENDPOINTS.questions.delete,
        { params: { id: String(id) } },
      ) as any;

      const envelope = assertApiSuccess(response, 'Nao foi possivel excluir a questao.');
      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  /**
   * Alterna o estado salvo de uma questao para o usuario atual.
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

      const envelope = assertApiSuccess<{ isSaved?: boolean }>(response, 'Nao foi possivel atualizar os salvos.');
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
   * Limpa o progresso de respostas do usuario atual.
   * @since v1.0.0
   */
  async resetAnswers(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post<any>(
        ENDPOINTS.questions.resetAnswers,
        { user_id: userId },
      ) as any;

      const envelope = assertApiSuccess(response, 'Nao foi possivel limpar as respostas.');

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
