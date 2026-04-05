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
import type { UserStatistics, QuestionStatistics, PlatformStatistics } from './types';

export const statisticsService = {
  /**
   * Carrega os indicadores consolidados do usuario para alimentar dashboards
   * pessoais, progresso e comparativos.
   */
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    const response = await apiClient.get<ApiResponse<UserStatistics>>(
      `${ENDPOINTS.statistics.user}/${userId}`,
    ) as unknown as ApiResponse<UserStatistics>;
    return response.data;
  },

  /**
   * Carrega o agregado estatistico de uma questao especifica.
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
   */
  async getPlatformStatistics(): Promise<PlatformStatistics> {
    const response = await apiClient.get<ApiResponse<PlatformStatistics>>(
      ENDPOINTS.statistics.platform,
    ) as unknown as ApiResponse<PlatformStatistics>;
    return response.data;
  },

  /**
   * Atualiza o agregado estatistico do usuario depois de uma resposta.
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
