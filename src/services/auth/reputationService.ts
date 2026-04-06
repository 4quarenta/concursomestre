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

import { apiClient } from '@services/api';
import type { ApiResponse } from '@services/api';

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

/**
 * Fachada oficial de reputação e XP.
 * Mantem consultas e calculos locais fora da zona legada `src/features`.
 */
export const reputationService = {
    /**
     * Carrega o resumo de reputação do usuário.
     */
    async getUserReputation(userId: number): Promise<ReputationData | null> {
        try {
            const response = await apiClient.get<ApiResponse<ReputationData>>(
                '/users/reputation',
                { params: { user_id: userId.toString() } }
            );
            return response.data.data || null;
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    },

    /**
     * Calcula o XP mínimo exigido para um determinado nivel.
     */
    calculateXPForLevel(level: number): number {
        return Math.floor(100 * Math.pow(1.5, level - 1));
    },

    /**
     * Resolve o nivel do usuário a partir do XP acumulado.
     */
    calculateLevelFromXP(xp: number): number {
        let level = 1;
        while (xp >= this.calculateXPForLevel(level + 1)) {
            level++;
        }
        return level;
    },

    /**
     * Calcula o percentual de progresso dentro do nivel atual.
     */
    calculateProgress(xp: number, level: number): number {
        const currentLevelXP = this.calculateXPForLevel(level);
        const nextLevelXP = this.calculateXPForLevel(level + 1);
        const xpInCurrentLevel = xp - currentLevelXP;
        const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
        return (xpInCurrentLevel / xpNeededForNextLevel) * 100;
    },

    /**
     * Solicita concessao de XP ao backend.
     */
    async awardXP(userId: number, xp: number, reason: string): Promise<boolean> {
        try {
            const response = await apiClient.post<ApiResponse>(
                '/users/award-xp',
                { user_id: userId, xp, reason }
            );
            return response.data.success;
        } catch (error) {
            console.error('Error awarding XP:', error);
            return false;
        }
    },

    /**
     * Calcula impacto reputacional local de uma ação de moderação.
     */
    calculateImpact(action: 'resolved' | 'ignored', targetRole: 'reporter' | 'author'): number {
        if (targetRole === 'author') {
            return action === 'resolved' ? -10 : 0;
        }

        return action === 'resolved' ? 5 : -5;
    },

    /**
     * Atualiza o score local respeitando o intervalo permitido.
     */
    updateScore(currentReputation: number, impact: number): number {
        const newScore = currentReputation + impact;
        return Math.max(0, Math.min(100, newScore));
    },

    /**
     * Traduz score de reputação em estado de conta local.
     */
    checkAccountStatus(score: number): 'active' | 'suspended' | 'banned' {
        if (score <= 10) return 'banned';
        if (score <= 30) return 'suspended';
        return 'active';
    },
};

export default reputationService;
