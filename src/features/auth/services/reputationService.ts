/**
 * Reputation Service
 * Handles user reputation and XP calculations with moderation helpers
 */

import { apiClient } from '@core/api';
import type { ApiResponse } from '@core/api/types';

export interface ReputationData {
    user_id: number;
    level: number;
    xp: number;
    total_questions_answered: number;
    correct_answers: number;
    streak_days: number;
    badges: string[];
    reputation?: number;
}

export const reputationService = {
    /**
     * Get user reputation data
     */
    async getUserReputation(userId: number): Promise<ReputationData | null> {
        try {
            const response = await apiClient.get<ApiResponse<ReputationData>>(
                `/users/reputation`,
                { params: { user_id: userId.toString() } }
            );
            return response.data.data || null;
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    },

    /**
     * Calculate XP for level
     */
    calculateXPForLevel(level: number): number {
        return Math.floor(100 * Math.pow(1.5, level - 1));
    },

    /**
     * Calculate level from XP
     */
    calculateLevelFromXP(xp: number): number {
        let level = 1;
        while (xp >= this.calculateXPForLevel(level + 1)) {
            level++;
        }
        return level;
    },

    /**
     * Calculate progress to next level
     */
    calculateProgress(xp: number, level: number): number {
        const currentLevelXP = this.calculateXPForLevel(level);
        const nextLevelXP = this.calculateXPForLevel(level + 1);
        const xpInCurrentLevel = xp - currentLevelXP;
        const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
        return (xpInCurrentLevel / xpNeededForNextLevel) * 100;
    },

    /**
     * Award XP to user
     */
    async awardXP(userId: number, xp: number, reason: string): Promise<boolean> {
        try {
            const response = await apiClient.post<ApiResponse>(
                `/users/award-xp`,
                { user_id: userId, xp, reason }
            );
            return response.data.success;
        } catch (error) {
            console.error('Error awarding XP:', error);
            return false;
        }
    },

    // ============================================
    // MODERATION HELPERS (for local calculations)
    // ============================================

    /**
     * Calculate reputation impact of moderation action
     */
    calculateImpact(action: 'resolved' | 'ignored', targetRole: 'reporter' | 'author'): number {
        if (targetRole === 'author') {
            // Author of reported content
            return action === 'resolved' ? -10 : 0; // Negative impact if report is valid
        } else {
            // User who reported
            return action === 'resolved' ? 5 : -5; // Reward valid reports, penalize bad ones
        }
    },

    /**
     * Update reputation score
     */
    updateScore(currentReputation: number, impact: number): number {
        const newScore = currentReputation + impact;
        return Math.max(0, Math.min(100, newScore));
    },

    /**
     * Check account status based on reputation
     */
    checkAccountStatus(score: number): 'active' | 'suspended' | 'banned' {
        if (score <= 10) return 'banned';
        if (score <= 30) return 'suspended';
        return 'active';
    },
};

export default reputationService;
