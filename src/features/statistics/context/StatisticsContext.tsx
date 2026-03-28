/**
 * Statistics Context
 * Provides statistics data and actions
 */

import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { statisticsService } from '../services/statisticsService';
import type { StatisticsContextType, UserStatistics, QuestionStatistics, PlatformStatistics } from '../types';

const StatisticsContext = createContext<StatisticsContextType | undefined>(undefined);

interface StatisticsProviderProps {
    children: ReactNode;
}

export const StatisticsProvider: React.FC<StatisticsProviderProps> = ({ children }) => {
    const [userStats, setUserStats] = useState<UserStatistics | null>(null);
    const [questionStats, setQuestionStats] = useState<Map<number, QuestionStatistics>>(new Map());
    const [platformStats, setPlatformStats] = useState<PlatformStatistics | null>(null);

    const fetchUserStatistics = useCallback(async (userId: string) => {
        try {
            const stats = await statisticsService.getUserStatistics(userId);
            setUserStats(stats);
        } catch (error) {
            console.error('Error fetching user statistics:', error);
        }
    }, []);

    const fetchQuestionStatistics = useCallback(async (questionId: number) => {
        try {
            const stats = await statisticsService.getQuestionStatistics(questionId);
            setQuestionStats(prev => new Map(prev).set(questionId, stats));
        } catch (error) {
            console.error('Error fetching question statistics:', error);
        }
    }, []);

    const fetchPlatformStatistics = useCallback(async () => {
        try {
            const stats = await statisticsService.getPlatformStatistics();
            setPlatformStats(stats);
        } catch (error) {
            console.error('Error fetching platform statistics:', error);
        }
    }, []);

    const updateUserStatistics = useCallback(async (userId: string) => {
        try {
            await fetchUserStatistics(userId);
        } catch (error) {
            console.error('Error updating user statistics:', error);
        }
    }, [fetchUserStatistics]);

    const value: StatisticsContextType = {
        userStats,
        questionStats,
        platformStats,
        fetchUserStatistics,
        fetchQuestionStatistics,
        fetchPlatformStatistics,
        updateUserStatistics,
    };

    return (
        <StatisticsContext.Provider value={value}>
            {children}
        </StatisticsContext.Provider>
    );
};

export const useStatistics = (): StatisticsContextType => {
    const context = useContext(StatisticsContext);
    if (!context) {
        throw new Error('useStatistics must be used within StatisticsProvider');
    }
    return context;
};

export default StatisticsProvider;
