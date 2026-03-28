/**
 * Statistics Service
 * Handles all statistics-related API calls
 */

import { apiClient, ENDPOINTS } from '@core/api';
import type { ApiResponse } from '@core/api/types';
import type { UserStatistics, QuestionStatistics, PlatformStatistics } from '../types';

export const statisticsService = {
    /**
     * Get user statistics
     */
    async getUserStatistics(userId: string): Promise<UserStatistics> {
        const response = await apiClient.get<ApiResponse<UserStatistics>>(
            `/statistics/user/${userId}`
        ) as unknown as ApiResponse<UserStatistics>;
        return response.data;
    },

    /**
     * Get question statistics
     */
    async getQuestionStatistics(questionId: number): Promise<QuestionStatistics> {
        const response = await apiClient.get<ApiResponse<QuestionStatistics>>(
            `/statistics/question/${questionId}`
        ) as unknown as ApiResponse<QuestionStatistics>;
        return response.data;
    },

    /**
     * Get platform-wide statistics
     */
    async getPlatformStatistics(): Promise<PlatformStatistics> {
        const response = await apiClient.get<ApiResponse<PlatformStatistics>>(
            '/statistics/platform'
        ) as unknown as ApiResponse<PlatformStatistics>;
        return response.data;
    },

    /**
     * Update user statistics (called after answering questions)
     */
    async updateUserStatistics(userId: string, data: {
        questionId: number;
        isCorrect: boolean;
        timeSpent: number;
    }): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            `/statistics/user/${userId}/update`,
            data
        ) as unknown as ApiResponse;
        return { success: response.success };
    },
};

export default statisticsService;
