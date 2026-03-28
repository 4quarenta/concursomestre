/**
 * Bank Analysis Service (Raio-X)
 * Handles exam board analysis and pattern detection
 */

import { apiClient } from '@core/api';
import type { BankAnalysis, AnalyticsData } from '../types';

export const bankAnalysisService = {
    /**
     * Get analysis for a specific exam board
     */
    async getAnalysis(boardId: string): Promise<BankAnalysis> {
        const response = await apiClient.get('/analysis/board', {
            params: { boardId },
        });
        return response.data.analysis;
    },

    /**
     * Get user analytics data
     */
    async getUserAnalytics(): Promise<AnalyticsData> {
        const response = await apiClient.get('/analysis/user');
        return response.data.analytics;
    },

    /**
     * Get pattern insights for a board
     */
    async getPatternInsights(boardId: string): Promise<any> {
        const response = await apiClient.get('/analysis/patterns', {
            params: { boardId },
        });
        return response.data.insights;
    },
};

export default bankAnalysisService;
