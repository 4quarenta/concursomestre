/**
 * Rankings Service
 * Handles all ranking-related API calls for post-exam rankings
 */

import { apiClient, ENDPOINTS } from '@core/api';
import type { Ranking } from '../../../../types';

export const rankingsService = {
    /**
     * Fetch rankings by period
     */
    async getRankings(period: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'all-time'): Promise<Ranking> {
        const response = await apiClient.get(ENDPOINTS.rankings.list, {
            params: { period },
        });
        return response.data.ranking;
    },

    /**
     * Update user ranking (called after answering questions)
     */
    async updateRanking(score: number): Promise<{ success: boolean }> {
        const response = await apiClient.post(ENDPOINTS.rankings.update, { score });
        return response.data;
    },
};

export default rankingsService;
