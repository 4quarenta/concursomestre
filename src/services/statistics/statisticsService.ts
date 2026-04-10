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

import { apiClient, ENDPOINTS } from '@services/api';
import type { ApiResponse } from '@services/api';
import type {
  UserStatistics,
  QuestionStatistics,
  PlatformStatistics,
  StudySessionPayload,
  StudySessionResult,
} from './types';

/**
 * Fachada oficial do dominio de estatisticas.
 * Ela alimenta visoes de usuário, questão e plataforma sem expor rotas cruas para a UI.
 * @since 1.0.0
 */
export const statisticsService = {
  /**
   * Carrega os indicadores consolidados do usuário para alimentar dashboards
   * pessoais, progresso e comparativos.
   * @since 1.0.0
   */
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    const response = await apiClient.get<ApiResponse<UserStatistics>>(
      `${ENDPOINTS.statistics.user}/${userId}`,
    ) as unknown as ApiResponse<UserStatistics>;
    const payload = (response.data || response) as Partial<UserStatistics>;
    return {
      questionStudyTime: 0,
      readingStudyTime: 0,
      totalStudyTime: 0,
      lastActivity: '',
      subjectBreakdown: [],
      ...payload,
    };
  },

  /**
   * Carrega o agregado estatistico de uma questão especifica.
   * @since 1.0.0
   */
  async getQuestionStatistics(questionId: number): Promise<QuestionStatistics> {
    const response = await apiClient.get<ApiResponse<QuestionStatistics>>(
      `${ENDPOINTS.statistics.question}/${questionId}`,
    ) as unknown as ApiResponse<QuestionStatistics>;
    return response.data;
  },

  /**
   * Carrega indicadores globais da plataforma para areas administrativas e
   * paineis executivos.
   * @since 1.0.0
   */
  async getPlatformStatistics(): Promise<PlatformStatistics> {
    const response = await apiClient.get<ApiResponse<PlatformStatistics>>(
      ENDPOINTS.statistics.platform,
    ) as unknown as ApiResponse<PlatformStatistics>;
    return response.data;
  },

  /**
   * Registra uma sessao de estudo consolidada no backend oficial.
   * @since v1.0.0
   */
  async recordStudySession(payload: StudySessionPayload): Promise<StudySessionResult> {
    const response = await apiClient.post<ApiResponse<StudySessionResult>>(
      ENDPOINTS.statistics.studySession,
      {
        practice_seconds: payload.practiceSeconds,
        simulation_seconds: payload.simulationSeconds,
        reading_seconds: payload.readingSeconds,
        started_at: payload.startedAt,
        ended_at: payload.endedAt,
        source_context: payload.sourceContext || {},
      },
    ) as unknown as ApiResponse<StudySessionResult>;

    return (response.data || response) as StudySessionResult;
  },

  /**
   * Atualiza o agregado estatistico do usuário depois de uma resposta.
   * @since 1.0.0
   */
  async updateUserStatistics(userId: string, data: {
    questionId: number;
    isCorrect: boolean;
    timeSpent: number;
  }): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse>(
      `${ENDPOINTS.statistics.user}/${userId}/update`,
      data,
    ) as unknown as ApiResponse;
    return { success: response.success };
  },
};

export default statisticsService;
