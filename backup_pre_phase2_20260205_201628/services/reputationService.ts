
import { UserProfile, ErrorReport } from '../types';

/**
 * Reputation Service
 * Calculates and manages user reputation scores based on moderation history.
 */
export const reputationService = {
    /**
     * Calculates the reputation impact of a moderation action.
     * @param action The moderation action taken ('resolved' for valid reports, 'ignored' for invalid ones)
     * @param targetRole The role of the user being affected ('reporter' or 'author')
     */
    calculateImpact: (action: 'resolved' | 'ignored', targetRole: 'reporter' | 'author'): number => {
        if (targetRole === 'author') {
            // Author of reported content
            return action === 'resolved' ? -10 : 0; // Negative impact if report is valid
        } else {
            // User who reported
            return action === 'resolved' ? 5 : -5; // Reward valid reports, penalize bad ones
        }
    },

    /**
     * Updates a user's reputation score.
     */
    updateScore: (currentReputation: number, impact: number): number => {
        const newScore = currentReputation + impact;
        return Math.max(0, Math.min(100, newScore));
    },

    /**
     * Status logic based on reputation
     */
    checkAccountStatus: (score: number): 'active' | 'suspended' | 'banned' => {
        if (score <= 10) return 'banned';
        if (score <= 30) return 'suspended';
        return 'active';
    }
};
